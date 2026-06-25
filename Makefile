# SAM build targets — instalan solo las dependencias Lambda (sin uvicorn, moto, pywin32)
LAMBDA_REQS = requirements-lambda.txt

build-PyzzeriaFunction build-PyzzeriaWsConnectFunction build-PyzzeriaWsDisconnectFunction build-PyzzeriaStatusUpdateFunction:
	pip install -r $(LAMBDA_REQS) -t "$(ARTIFACTS_DIR)" --quiet
	cp -r backend "$(ARTIFACTS_DIR)/backend"
