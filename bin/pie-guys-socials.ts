#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PieGuysSocialsStack } from "../lib/pie-guys-socials-stack";

const app = new cdk.App();

// Environment config from CDK CLI or defaults to AWS SDK behavior
// Use: cdk deploy --context account=123456789 --context region=us-east-1
// Or rely on AWS SDK default credential chain and region
new PieGuysSocialsStack(app, "PieGuysSocialsStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
