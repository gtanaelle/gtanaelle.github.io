---
title: "Flow Matching Policy Optimization with Mirror Descent and Entropy Constraints"
authors: "**Ting Gao**, Stavros Orfanoudakis, Nan Lin, Winnie Daamen, Serge Hoogendoorn, Elvin Isufi"
venue: "NeurIPS 2026"
type: conference
paper: https://arxiv.org/abs/2603.17685
code: https://github.com/gtanaelle/FMER
---

## Abstract

Balancing policy expressiveness with the exploration-exploitation trade-off is a core challenge in online Reinforcement Learning (RL). While Stochastic Differential Equation (SDE)-based diffusion policies can represent complex, multimodal action distributions, they suffer from two critical limitations: their stochastic reverse processes render entropy intractable (necessitating heuristic exploration), and computing policy gradients through long denoising chains is expensive and unstable. In this work, we show that ODE-based flow matching inherently resolves these issues by enabling both simulation-free policy optimization and tractable entropy computation. Building on this, we introduce Flow Matching Policy Optimization with Mirror Descent and Entropy Constraints (FMER). Our framework exploits this insight in three ways. First, we theoretically establish that minimizing an advantage-weighted conditional flow matching loss acts as a simulation-free surrogate for policy mirror descent. This steers the velocity field toward high-value regions while entirely avoiding backpropagation through the ODE solver. Second, we derive an analytic entropy objective that corrects for the density distortion caused by the $\tanh$ transformation (mapping an unbounded latent space to bounded actions), thereby facilitating principled maximum-entropy optimization. Finally, we dynamically tune the mirror descent temperature based on the effective sample size to enforce a robust trust region during training. Empirical evaluations demonstrate that FMER achieves superior performance on the challenging sparse-reward FrankaKitchen environment, while maintaining competitive results across standard dense-reward MuJoCo benchmarks.
