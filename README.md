# Observable AI Streaming on AWS

Stream structured LLM responses from Bedrock Claude through AWS API Gateway REST, Lambda, and Middy with deferred observability using TransformStream flush(). Built with AI SDK v6.

## Blog Series

Companion code for a four-part series on [dev.to](https://dev.to/pabloalbaladejo/series/observable-ai-streaming-on-aws):

1. [Streaming LLM Responses Through API Gateway REST with Lambda](https://dev.to/pabloalbaladejo/observable-ai-streaming-on-aws-part-1-api-gateway-rest-with-lambda-595a)
2. [The Middy After Hook Problem](https://dev.to/pabloalbaladejo/observable-ai-streaming-on-aws-part-2-the-middy-after-hook-problem-3b7c)
3. [Deferred Observability with TransformStream flush()](https://dev.to/pabloalbaladejo/observable-ai-streaming-on-aws-part-3-the-transformstream-pipeline-4p4j)
4. [Complete CDK Stack with Tests](https://dev.to/pabloalbaladejo/observable-ai-streaming-on-aws-part-4-complete-cdk-stack-38cj)

## Progressive Development

Each step builds on the previous one. Check the PRs to see the delta:

| Branch | PR | Description |
|--------|-----|-------------|
| `step-1/api-gateway-streaming` | #1 | CDK stack, Lambda handler, AI SDK streaming |
| `step-2/stream-error-handling` | #2 | AbortError classification for streaming |
| `step-3/transformstream-observability` | #3 | TransformStream pipeline for deferred observability |
| `step-4/complete-cdk-stack` | #4 | Test suite and production readiness |

## Quick Start

```bash
npm install
npx cdk deploy
```

## Prerequisites

- Node.js 22+
- AWS CLI configured
- AWS CDK CLI
- Bedrock model access enabled for Claude 3.5 Sonnet v2

## Key Patterns

- **TransformStream Pipeline**: WHATWG `flush()` as deferred execution point after stream completion
- **Dual Middleware Bridge**: In-memory store connecting AI SDK and Middy middleware systems
- **Deferred Observability**: Attach logging to the data pipeline, not the HTTP lifecycle

## License

MIT
