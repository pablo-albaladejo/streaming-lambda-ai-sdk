#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StreamingStack } from '../lib/streaming-stack';

const app = new cdk.App();

new StreamingStack(app, 'StreamingLlmStack', {
  description: 'API Gateway REST + Lambda streaming + AI SDK + Bedrock',
});
