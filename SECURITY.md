# Security

The current release line is supported. Report vulnerabilities through this repository's GitHub private vulnerability reporting, not through a public issue containing exploit details or private project data.

cca reads Claude Code's local conversation records and writes only to its own data folder (`~/.cost-adviser-for-claude`). It sends nothing over the network; `cca serve` listens on 127.0.0.1 only. The cost-adviser skill is an instruction skill, not a sandbox or a permission system: the agent uses the tools and access available in its host environment.
