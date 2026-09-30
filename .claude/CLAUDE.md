# Armchair

> This file is loaded into every Claude session. Keep it lean and accurate.

## What This Is
Friends rate each Dancing with the Stars performance 1-10 on their phones, blind and final, then see how the judges and everyone else scored it. Live at `dwts.xomware.com`. `armchair` is the working name and the permanent resource prefix; the domain is config and will move once the family domain is picked.

The repo is `domgiordano/armchair` (repo id 1398549188), a public personal repo. Use `gh -R domgiordano/armchair`. The plan is `docs/features/dwts-companion/PLAN.md`, with `BRAINSTORM.md` and `RESEARCH.md` beside it.

## Stack
A derby-style monorepo copied from `/Users/dom/Code/smirnoff-league`:
- `frontend/`: Next.js 16 static export (`output: "export"`, `trailingSlash: true`), Tailwind 4, vitest. Mobile-first.
- `hub/`: the Armchair Judge hub at `armchairjudge.com` (`var.hub_domain_name`), a second static Next app with the same config. Deployed by `deploy-hub.yml`.
- `backend/`: Python 3.12 Lambdas; shared code in `backend/lambdas/common/`, shipped as the `armchair-shared-packages` layer.
- `infrastructure/terraform/`: S3 + CloudFront via `domgiordano/web-hosting` v1.4.0 behind the shared CloudFront WAF. State in `s3://xomware-terraform-state/armchair/terraform.tfstate`, locks in `xomware-terraform-locks`.

`xomware-infrastructure` owns the Terraform plan/apply roles this repo's workflow assumes (`oidc_armchair_terraform.tf`). This stack owns its own deploy role (`oidc_deploy.tf`).

## Key Commands
- `cd frontend && npm test`: vitest
- `cd hub && npm test`: vitest
- `cd backend && pytest`
- Terraform runs only in GitHub Actions: plan on PR, apply on push to `main`. Never run it locally, not even `init`.

## Project Config
```yaml
pm_tool: none
base_branch: main
test_commands:
  - cd frontend && npm test
  - cd hub && npm test
  - cd backend && pytest
build_commands:
  - cd frontend && npm run build
  - cd hub && npm run build
```

## Repo secrets
- `AWS_TERRAFORM_PLAN_ROLE_ARN`, `AWS_TERRAFORM_APPLY_ROLE_ARN`: outputs of `xomware-infrastructure`.
- `AWS_ROLE_ARN`: this stack's `deploy_role_arn` output, set after the first apply.

## Constraints
- Public repo. No friends' names, emails or scores in git. Fixtures hold only public show data.
- The client-side gate is UX, not security. Score visibility is decided server-side, by one module (`common/gate.py`, per the plan).
- The API module supports exactly two path levels, `/<prefix>/<part>`; ids go in the query string or body.
- No emoji glyphs in the UI. Use SVG or text.

## Lessons
