#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PieGuysSocialsStack } from "../lib/pie-guys-socials-stack";

const app = new cdk.App();
new PieGuysSocialsStack(app, "PieGuysSocialsStack", {
  env: { account: process.env.AWS_ACCOUNT, region: process.env.AWS_REGION },
});
