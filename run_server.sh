#!/bin/bash
# Local preview: http://127.0.0.1:4000
export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
bundle config set --local path vendor/bundle >/dev/null
bundle install --quiet
bundle exec jekyll serve --livereload
