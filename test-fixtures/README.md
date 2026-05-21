# AVA Test Fixtures

JSON artifacts for QA and integration testing of the Avakado (AVA) platform. **No changes were made inside `src/`.**

## Folder Structure

```
test-fixtures/
├── README.md                          # This file
├── document-manifest.json             # Master catalog of all required test documents
├── test-scenarios.json                # End-to-end test scenarios with prerequisites
├── environment-checklist.json         # Required env vars and external services
├── graphql-requests/                  # Sample GraphQL operation payloads
├── rest-payloads/                     # REST endpoint request bodies
├── entity-samples/                    # Sample domain entity JSON
├── knowledge-documents/               # Metadata for knowledge-base test files
└── sample-files/                    # Minimal binary/text files for upload tests
```

## How to Use

1. Review `document-manifest.json` for the full list of files and fixtures required.
2. Use `graphql-requests/*.json` as Postman/Insomnia/Apollo Studio bodies (set `operationName` when noted).
3. Run scenarios in `test-scenarios.json` in order for full product smoke testing.
4. Place real PDF/DOCX/XLSX files in `sample-files/` per manifest (minimal samples provided where possible).
5. Configure sandbox credentials per `environment-checklist.json`.

## Authentication

Most GraphQL requests require:

```
Authorization: Bearer <accessToken>
```

Obtain token via `graphql-requests/01-login.json`, then substitute `{{ACCESS_TOKEN}}` placeholders.

## Public Operations (no token)

- `02-register.json`
- `03-fetch-public-plans.json`
- `04-ephemeral-token.json`
