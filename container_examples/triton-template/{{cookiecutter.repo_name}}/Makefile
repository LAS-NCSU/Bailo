#################################################################################
# GLOBALS                                                                       #
#################################################################################

PROJECT_DIR := $(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))
BUCKET = {{ cookiecutter.s3_bucket }}
PROFILE = {{ cookiecutter.aws_profile }}
PROJECT_NAME = {{ cookiecutter.repo_name }}
MODEL_NAME = {{cookiecutter.model_name}}
PYTHON_TARGET_VERSION = python3.10
PYTHON_INTERPRETOR = python3.11


#################################################################################
# COMMANDS                                                                      #
#################################################################################


.PHONY: setup_env
## Create python virtualenv and install dependencies.
setup_env:
ifeq ($(findstring ModuleNotFoundError,$(HAS_VURTUALENV)),ModuleNotFoundError)
	$(info $(PYTHON_INTERPRETOR) -m virtualenv not found, installing)
	# TMP := $(shell $(PYTHON_INTERPRETOR) -m pip install -q virtualenv)
else
	$(info Found $(PYTHON_INTERPRETOR) -m virtualenv, skipping install)
endif
	@echo $(wildcard ./.virtenv/bin/pip)
ifeq ($(wildcard .virtenv/bin/pip),)
	$(info No virtual env found creating...)
	$(PYTHON_INTERPRETOR) -m virtualenv .virtenv --python=$(PYTHON_TARGET_VERSION)
endif
	$(info Installing python dependencies)
	.virtenv/bin/pip install -r dev-requirements.txt

.PHONY: build
## Build distribution including conda pack tar.
build:
	python utils.py build -v

.PHONY: build_src
## Build distribution src code only.
build_src:
	python utils.py build --skip pack -v

.PHONY: clean
## Delete all compiled Python files and dist folder
clean:
	find . -type f -name "*.py[co]" -delete
	find . -type d -name "__pycache__" -delete
	python utils.py clean

.PHONY: lint
## Lint using flake8
lint:
	flake8 src

.PHONY: sync_artifacts_to_s3
## Upload artifacts to S3
sync_artifacts_to_s3:
ifeq (default,$(PROFILE))
	aws s3 sync dist/$(MODEL_NAME) s3://$(BUCKET)/triton/
else
	aws s3 sync dist/$(MODEL_NAME) s3://$(BUCKET)/triton/ --profile $(PROFILE)
endif

.PHONY: sync_artifacts_from_s3
## Download artifacts from S3
sync_artifacts_from_s3:
ifeq (default,$(PROFILE))
	aws s3 sync s3://$(BUCKET)/triton/$(MODEL_NAME) dist/
else
	aws s3 sync s3://$(BUCKET)/triton/$(MODEL_NAME) dist/ --profile $(PROFILE)
endif

.PHONY: create_conda_environment
## Set up python interpreter environment
create_conda_environment:
ifeq (,$(shell which conda))
	@echo ">>> No conda detected in eviroment."
else
	@echo ">>> Detected conda, creating conda environment."
	conda create --name $(PROJECT_NAME) python=3.10
	@echo ">>> New conda env created. Activate with:\nsource activate $(PROJECT_NAME)"
endif


#################################################################################
# PROJECT RULES                                                                 #
#################################################################################



#################################################################################
# Self Documenting Commands                                                     #
#################################################################################

.DEFAULT_GOAL := help

# Inspired by <http://marmelab.com/blog/2016/02/29/auto-documented-makefile.html>
# sed script explained:
# /^##/:
# 	* save line in hold space
# 	* purge line
# 	* Loop:
# 		* append newline + line to hold space
# 		* go to next line
# 		* if line starts with doc comment, strip comment character off and loop
# 	* remove target prerequisites
# 	* append hold space (+ newline) to line
# 	* replace newline plus comments by `---`
# 	* print line
# Separate expressions are necessary because labels cannot be delimited by
# semicolon; see <http://stackoverflow.com/a/11799865/1968>
.PHONY: help
help:
	@echo "$$(tput bold)Available rules:$$(tput sgr0)"
	@echo
	@sed -n -e "/^## / { \
		h; \
		s/.*//; \
		:doc" \
		-e "H; \
		n; \
		s/^## //; \
		t doc" \
		-e "s/:.*//; \
		G; \
		s/\\n## /---/; \
		s/\\n/ /g; \
		p; \
	}" ${MAKEFILE_LIST} \
	| LC_ALL='C' sort --ignore-case \
	| awk -F '---' \
		-v ncol=$$(tput cols) \
		-v indent=40 \
		-v col_on="$$(tput setaf 6)" \
		-v col_off="$$(tput sgr0)" \
	'{ \
		printf "%s%*s%s ", col_on, -indent, $$1, col_off; \
		n = split($$2, words, " "); \
		line_length = ncol - indent; \
		for (i = 1; i <= n; i++) { \
			line_length -= length(words[i]) + 1; \
			if (line_length <= 0) { \
				line_length = ncol - indent - length(words[i]) - 1; \
				printf "\n%*s ", -indent, " "; \
			} \
			printf "%s ", words[i]; \
		} \
		printf "\n"; \
	}' \
	| more $(shell test $(shell uname) = Darwin && echo '--no-init --raw-control-chars')
