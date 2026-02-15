import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';
import * as path from 'node:path';

export class StreamingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- Lambda Function ---

    const fn = new lambda.Function(this, 'StreamingHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash',
            '-c',
            [
              'npx esbuild index.ts --bundle --platform=node --target=node22 --outfile=/asset-output/index.mjs --format=esm --external:@aws-sdk/*',
              'cp /asset-output/index.mjs /asset-output/index.js',
            ].join(' && '),
          ],
          local: {
            tryBundle(outputDir: string): boolean {
              // Use local esbuild if available
              try {
                const { execSync } = require('node:child_process');
                execSync(
                  `npx esbuild lambda/index.ts --bundle --platform=node --target=node22 --outfile=${outputDir}/index.js --format=esm --external:@aws-sdk/*`,
                  { cwd: path.join(__dirname, '..') },
                );
                return true;
              } catch {
                return false;
              }
            },
          },
        },
      }),
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    // Grant Bedrock model invocation permissions
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: ['arn:aws:bedrock:*::foundation-model/*'],
      }),
    );

    // --- API Gateway REST API ---

    const api = new apigateway.RestApi(this, 'StreamingApi', {
      restApiName: 'streaming-llm-api',
      description: 'API Gateway REST with Lambda response streaming',
      deployOptions: {
        stageName: 'v1',
      },
    });

    const streamResource = api.root.addResource('stream');

    // OPTIONS for CORS preflight
    streamResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    });

    // POST /stream — Lambda proxy integration
    const postMethod = streamResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(fn, { proxy: true }),
    );

    // --- CfnMethod escape hatch for streaming ---
    // CDK's L2 construct does not expose ResponseTransferMode or the
    // response-streaming-invocations URI. We override the underlying
    // CloudFormation resource directly.

    const cfnMethod = postMethod.node.defaultChild as apigateway.CfnMethod;

    cfnMethod.addPropertyOverride('Integration.ResponseTransferMode', 'STREAM');
    cfnMethod.addPropertyOverride('Integration.TimeoutInMillis', 60_000);
    cfnMethod.addPropertyOverride(
      'Integration.Uri',
      cdk.Fn.sub(
        'arn:aws:apigateway:${AWS::Region}:lambda:path/2021-11-15/functions/${FnArn}/response-streaming-invocations',
        { FnArn: fn.functionArn },
      ),
    );

    // --- Outputs ---

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: `${api.url}stream`,
      description: 'POST endpoint for streaming LLM responses',
    });
  }
}
