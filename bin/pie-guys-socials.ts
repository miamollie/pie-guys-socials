#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PieGuysSocialsStack } from "../lib/pie-guys-socials-stack";
import { AWS_REGION, AWS_ACCOUNT } from "../consts";

const app = new cdk.App();
new PieGuysSocialsStack(app, "PieGuysSocialsStack", {
  env: { account: AWS_ACCOUNT, region: AWS_REGION },
});
