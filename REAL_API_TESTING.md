# Real API Testing Setup

This project supports running the automated test suite against the live image and story generation services. To do so, valid API credentials must be provided via environment variables.

## 1. Create `.env.test`
Copy the provided `.env.test.example` file to `.env.test` in the project root and fill in your API keys:

```bash
cp .env.test.example .env.test
```

Populate the file with your credentials:

- `OPENROUTER_API_KEY` – required for story generation.
- `OPENAI_API_KEY` – optional, used for DALL‑E image generation.
- `STABILITY_API_KEY` – optional, used for Stable Diffusion generation.
- `REPLICATE_API_TOKEN` – optional, used for Replicate models.
- `GOOGLE_CLOUD_PROJECT_ID` and `GOOGLE_SERVICE_ACCOUNT_KEY` – optional, used for Google Imagen/Vertex AI.

Any variables left blank will disable that provider during tests.

## 2. Run Tests with Credentials
Use the helper script to load the environment file and execute the backend tests:

```bash
./scripts/load-test-env.sh
```

The script sources `.env.test` if present and then runs `npm test` inside the `backend` directory. You can pass additional arguments to Jest after the script.

## Notes
- The `.env.test` file is ignored by git so your secrets remain local.
- If no credentials are supplied, tests will run using the mocked services and skip live generation.
