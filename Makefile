.PHONY: check done exit setup-hooks

check:
	bash docs/harness/done_check.sh

done:
	bash docs/harness/done_check.sh

exit:
	@echo "Session complete. Run 'git status' to verify clean state."

setup-hooks:
	git config core.hooksPath hooks
	@echo "Git hooks configured to run from hooks/ directory."
