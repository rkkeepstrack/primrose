.PHONY: dev build check fixture snapshots snapshots-update

# Pinned to the same version as @playwright/test in frontend/package.json,
# and by digest (same as .github/workflows/ci.yml): the image carries the
# matching Chromium and fonts, a re-pushed tag must not change the pixels.
PLAYWRIGHT_IMAGE = mcr.microsoft.com/playwright:v1.58.2-noble@sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d
# Runs as root (the node_modules volume is root's) and hands what it wrote
# back to the caller, or Linux hosts end up with root-owned build output.
SNAPSHOT_RUN = docker run --rm -t \
	-v "$(CURDIR)/frontend:/work" \
	-v primrose-e2e-node-modules:/work/node_modules \
	-w /work -e CI=$(CI) $(PLAYWRIGHT_IMAGE) \
	sh -c 'trap "chown -R $(shell id -u):$(shell id -g) dist e2e/__snapshots__ playwright-report test-results 2>/dev/null" EXIT; \
	npm ci --no-audit --no-fund && npm run build && npx playwright test

dev:
	wails dev

build:
	wails build -clean

check:
	go vet ./...
	go test ./...
	cd frontend && npm run format:check && npm run check && npm test

# Regenerates frontend/e2e/fixture.json from frontend/e2e/pet-store.
fixture:
	PRIMROSE_FIXTURE_OUT="$(CURDIR)/frontend/e2e/fixture.json" go test ./internal/e2efixture -run TestGenerate -count=1

# Screenshot tests, always inside the Playwright container so local and CI pixels agree.
snapshots:
	$(SNAPSHOT_RUN)'

snapshots-update:
	$(SNAPSHOT_RUN) --update-snapshots=all'
