---
title: "Flow Matching Policy Optimization with Mirror Descent and Entropy Constraints"
description: "Why ODE-based flow matching makes expressive RL policies trainable without backpropagating through the sampler, and with an entropy you can actually compute."
authors: "**Ting Gao**, Stavros Orfanoudakis, Nan Lin, Winnie Daamen, Serge Hoogendoorn, Elvin Isufi"
venue: "NeurIPS 2026"
type: conference
paper: https://arxiv.org/abs/2603.17685
code: https://github.com/gtanaelle/FMER
---

<div class="post__summary" markdown="1">

Diffusion policies can represent rich, multimodal behaviour, but they are hard to train with online reinforcement learning. You cannot measure how random they are, so exploration relies on guesswork, and every update has to push gradients back through a long chain of denoising steps. We show that switching to **flow matching** removes both problems at once.

Our method, FMER, trains the policy with a simple weighted regression loss instead of backpropagating through the sampler, and it controls exploration with an **exact entropy**. On the FrankaKitchen benchmark, FMER completes nearly twice as many tasks as the strongest baseline on the hardest settings.

</div>

<div class="fig__videos">
  <figure>
    <video src="{{ '/images/blog/fmer/fmer-kitchen.mp4' | relative_url }}" autoplay muted loop playsinline controls></video>
    <figcaption><strong>FMER</strong>: kettle → bottom burner → light switch → top burner → slide cabinet. All 5 tasks in under 100 steps.</figcaption>
  </figure>
  <figure>
    <video src="{{ '/images/blog/fmer/dipo-kitchen.mp4' | relative_url }}" autoplay muted loop playsinline controls></video>
    <figcaption><strong>DIPO</strong> (best baseline on this setting): top burner → slide cabinet → light switch, then stalls at 3 tasks.</figcaption>
  </figure>
</div>

## Why expressive policies, and why they are hard to train online

In continuous control, the standard Gaussian policy has a single peak. Many tasks, however, have *several* equally good ways to act in the same state: open the cabinet first or turn on the burner first; go left around the obstacle or go right. A single-peaked policy facing such a choice either commits to one option arbitrarily or averages between them and ends up doing neither well.

<figure class="fig">
  <div class="fig__panels">
    <div><p class="fig__label"><strong>SAC</strong> Gaussian</p><img src="{{ '/images/blog/fmer/multigoal-sac.png' | relative_url }}" alt="SAC policy on the 2D multi-goal task: arrows across the state space mostly point right and down." loading="lazy"></div>
    <div><p class="fig__label"><strong>DPMD</strong> Diffusion</p><img src="{{ '/images/blog/fmer/multigoal-dpmd.png' | relative_url }}" alt="DPMD policy on the 2D multi-goal task: arrows mostly point down or right." loading="lazy"></div>
    <div><p class="fig__label"><strong>FMER</strong> Flow matching</p><img src="{{ '/images/blog/fmer/multigoal-fmer.png' | relative_url }}" alt="FMER policy on the 2D multi-goal task: arrows point towards the nearest of the four goals." loading="lazy"></div>
  </div>
  <figcaption>A 2D task with four equally good goals (bright regions); red arrows show the action each policy picks. SAC and the diffusion policy DPMD keep steering towards the same few goals. FMER heads for whichever goal is nearest.</figcaption>
</figure>

Generative policies fix this by turning random noise into actions, conditioned on the state. Diffusion policies first became popular for learning from fixed datasets. Using them in *online* RL, where the policy has to improve itself from rewards, runs into two problems:

1. **You can't measure their randomness.** Methods like SAC explore by keeping the policy's entropy, its randomness, high. A diffusion model doesn't tell you its entropy, so existing methods fall back on rough approximations that bias exploration.
2. **Training is slow and unstable.** Improving the policy usually means backpropagating through every denoising step, which is expensive and noisy.

Flow matching generates actions by following a smooth, deterministic path from noise to action. A learned velocity field $$v_\theta$$ moves a noise sample $$x_0$$ step by step until it becomes an action:

$$
\frac{d}{dt}x_t = v_\theta(x_t, t, s), \qquad x_0 \sim \mathcal{N}(0, I).
$$

Because this path is deterministic, the probability of each action *can* be computed. Existing flow-based RL methods still backpropagate through that path, though, and approximate the entropy to keep the cost down. FMER avoids both: training never simulates the path, and the entropy is exact.

## Ingredient 1: policy mirror descent as weighted flow matching

Policy mirror descent improves a policy in small steps: each new policy should earn more reward than the current one while staying close to it. The ideal next policy has a simple form:

$$
\pi^*(a \mid s) \;=\; \frac{\pi_k(a \mid s)\, \exp\!\big(A(s,a)/\tau\big)}{Z(s)}.
$$

In words: take the current policy $$\pi_k$$ and boost the actions that are better than average (high advantage $$A$$). The temperature $$\tau$$ controls how big the step is, and $$Z(s)$$ just normalizes the result.

Fitting a flow policy to this target directly would mean differentiating through the whole generation path. Our main theoretical result (Theorem 1) shows that this isn't necessary. Sample some actions from the current policy, give each one the weight $$w(s,a) = \exp(A(s,a)/\tau)/Z(s)$$, and train with the ordinary flow matching loss, weighted by those numbers:

$$
\mathcal{L}_{\text{W-CFM}}(\theta) = \mathbb{E}\Big[\, w(s,a)\, \big\| v_\theta(x_t, t, s) - (x_1 - x_0) \big\|^2 \Big],
\qquad x_1 = \operatorname{arctanh}(a),\; x_t = (1-t)x_0 + t x_1 .
$$

The velocity field is asked to point along the straight line from the noise $$x_0$$ to the action $$x_1$$, and high-weight actions count more. The best fit of this weighted loss is exactly the mirror descent target $$\pi^*$$. Because the loss is a plain regression, there is no path to simulate and nothing to backpropagate through.

**Weigh every candidate, not just the best one.** In practice, FMER samples several candidate actions per state and lets the critic score them. Learning from all of them, in proportion to their weights, works better than copying only the top-scoring one: the top candidate may sit on a local peak, or the critic may simply overrate it.

**Step size, tuned automatically.** If $$\tau$$ is too large, the policy barely moves; if it is too small, a single candidate takes over. FMER measures how evenly the weights are spread with the effective sample size, $$\text{ESS} = 1/\sum_l \hat{w}_l^2$$, which runs from 1 (one candidate dominates) to $$M$$ (all $$M$$ candidates count equally). It adjusts $$\tau$$ to keep ESS at a target value, so it needs no per-environment tuning.

## Ingredient 2: an entropy you can compute exactly

Because the flow is deterministic, its entropy can be computed exactly by tracking how the flow stretches or squeezes space as it carries noise to actions. That stretching is the divergence of the velocity field, integrated along the path:

$$
H(p_1) = H(p_0) + \int_0^1 \mathbb{E}_{x_t}\big[\nabla_x \cdot v_\theta(x_t, t, s)\big]\, dt .
$$

There is a catch that is easy to miss. Robots need *bounded* actions, so FMER squashes its output into the valid range with $$a = \tanh(x_1)$$. That squashing distorts the probabilities, and what we care about is the randomness of the actual **action**, not of the value before squashing. Proposition 1 gives the corrected divergence in action space:

$$
\nabla_a \cdot v^a = \nabla_x \cdot v_\theta \;-\; 2\,\big\langle \tanh(x),\, v_\theta(x, t, s) \big\rangle .
$$

The second term pushes back when the policy piles probability onto the action limits. Like the main loss, the corrected entropy is evaluated along the same straight paths, so the flow never has to be simulated.

FMER then keeps the entropy above a target level, with a weight $$\alpha$$ that is tuned automatically, much like SAC. The full policy objective is

$$
\mathcal{L}_{\text{FMER}}(\theta) = \mathcal{L}_{\text{W-CFM}}(\theta) + \alpha\, \mathcal{L}_{\text{ent}}(\theta).
$$

## The training loop

<figure class="fig">
  <img src="{{ '/images/blog/fmer/overview.png' | relative_url }}" alt="Diagram of FMER: the flow matching policy generates a candidate action set, the critic weights it, the weights feed the weighted flow matching loss and the entropy loss, and the best action is executed and stored in the data buffer." loading="lazy">
  <figcaption>FMER at a glance. The policy proposes candidate actions, the critic weights them, and those weights drive the policy update together with the entropy term. During interaction, the best-rated candidate is executed and stored.</figcaption>
</figure>

Each training step does four things:

- **Act.** Generate a handful of candidate actions, execute the one the critic likes best, and store the result.
- **Critic.** Update the estimates of how good each action is.
- **Policy.** Weight the candidates by the critic's scores and update the policy with the weighted flow matching loss plus the entropy term.
- **Tune.** Adjust $$\alpha$$ to track the target entropy and $$\tau$$ to track the target ESS.

## Results

We compared FMER with eight baselines that use Gaussian, diffusion or flow policies. Every method was trained for one million steps, over 5 random seeds.

**FrankaKitchen (sparse reward).** A robot arm in a simulated kitchen has 280 steps and earns a reward only when it finishes a sub-task, such as moving the kettle. With rewards this rare, exploration is the main challenge. We test sets of 1, 2, 4 and 7 tasks. FMER is best on 1, 4 and 7 tasks and level with the best baseline on 2 (48% vs. 50%). The gap widens as tasks are added: with 7 tasks, FMER completes 40% vs. 23% for the next best method.

{% include fmer-kitchen-chart.html %}

The baselines fail in telling ways. SAC falls apart once there are several task orders to choose from. DPMD locks onto its early successes and can't move on. And the methods with approximate entropy (QVPO, SAC-Flow) explore poorly exactly where exploration matters most.

**MuJoCo (dense reward).** These standard locomotion tasks check that FMER's extra machinery doesn't hurt on easier problems. FMER scores highest on HalfCheetah and Walker2d and second on Humanoid. It falls behind on Hopper, a simple task where its extra exploration goes on longer than needed.

{% include fmer-mujoco-chart.html %}

**What matters.** Removing FMER's parts one at a time shows that each one earns its place:

- **Entropy constraint.** Without it, the policy turns almost deterministic early in training and completes 0% of the 7-task kitchen.
- **Weights.** With equal weights, the policy just imitates its own samples, and performance drops.
- **Squashing correction.** Without it, every MuJoCo score goes down, HalfCheetah from 12.3k to 7.7k.

FMER also trains faster than the diffusion baselines, though slower than the lightest flow-based method.

## Limitations

- **Speed.** FMER is slower than flow methods that generate actions in one or a few steps, because computing the exact entropy takes extra work.
- **Simulation only.** All experiments are in simulation. Whether the gains carry over to real robots is still an open question.

## Takeaway
{: .no-divider}

Choosing between diffusion and flow matching is not just about how fast you can sample. For online RL, flow matching's deterministic path is what makes a *principled* algorithm possible: the policy update becomes a weighted regression, and the policy's randomness becomes something you can measure and control. FMER puts both pieces together, and the gains show up exactly where exploration is hardest.

## Citation
{: .no-divider}

```bibtex
@inproceedings{gao2026fmer,
  title     = {Flow Matching Policy Optimization with Mirror Descent and Entropy Constraints},
  author    = {Gao, Ting and Orfanoudakis, Stavros and Lin, Nan and Daamen, Winnie and Hoogendoorn, Serge and Isufi, Elvin},
  booktitle = {Advances in Neural Information Processing Systems},
  year      = {2026}
}
```
