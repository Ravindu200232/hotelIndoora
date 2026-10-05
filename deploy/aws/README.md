# deploy/aws — how hotelIndoora runs on AWS

Everything here is infrastructure as code, applied with the AWS CLI. Nothing in
this folder contains a value: the secret lives in AWS Secrets Manager, and the
parameter file holds ids, sizes and names only.

## What `ec2.yml` creates (one stack, `hotelindoora-prod`)

| Piece | What it is |
| --- | --- |
| Four EC2 instances | `gateway` (t4g.small), `auth`, `rooms` and `bookings` (t4g.micro), each its own machine, from the latest Amazon Linux 2023 arm64 image |
| One Elastic IP each | so the MongoDB cluster's allow-list can name all four addresses, and the CloudFront origin never moves |
| nginx on each instance | listens on port 80 and proxies to the service on loopback, where the application itself binds |
| Security groups | the gateway takes port 80 only from CloudFront's origin-facing prefix list; each service takes port 80 only from the gateway's security group. Port 22 is never opened |
| IAM role | Systems Manager (administration with no open port), read on this application's release bucket, read on this application's secret, write on its own log groups |
| Release bucket | private, versioned, public access blocked |
| Four log groups | `/hotelindoora/prod/<service>`, 30-day retention, fed by the CloudWatch agent |
| Four alarms | a failed status check asks EC2 to recover that instance |
| Snapshot policy | seven daily snapshots of every volume tagged `Snapshot=true` (the instances tag their own root volume at first boot) |
| CloudFront distribution | the free HTTPS address; caching off, every method allowed, cookies and headers forwarded, HTTP redirected to HTTPS |
| No VPC, no NAT gateway | the account's default VPC, so the running cost stays where the plan put it |

## The commands

```powershell
# create or update everything
aws cloudformation deploy --template-file deploy/aws/ec2.yml --stack-name hotelindoora-prod `
  --capabilities CAPABILITY_NAMED_IAM --parameter-overrides file://deploy/aws/params.json `
  --tags app=hotelindoora env=prod managed-by=agentforge owner=Ravindu200232 `
  --no-fail-on-empty-changeset --region ap-south-1 --profile agentforge-console

# what it made
aws cloudformation describe-stacks --stack-name hotelindoora-prod --query "Stacks[0].Outputs" `
  --region ap-south-1 --profile agentforge-console
```

## Releasing and going back

`release.sh` runs **on an instance**, sent by Systems Manager, and is what a
release actually does: it downloads the release from the bucket, writes
`/etc/hotelindoora/env` from Secrets Manager at mode 600 with only the keys that
service needs, switches `current` to the new release, restarts the unit, and waits
for the health route. If the health route does not answer it points `current` back
at the previous release, restarts, prints the unit's last lines and exits non-zero.
It keeps the last five releases.

`rollback.sh` does the same switch by hand when a release has to be taken back:

```powershell
aws ssm send-command --document-name AWS-RunShellScript --instance-ids <instance-id> `
  --parameters file://deploy/aws/rollback-params.json --region ap-south-1 --profile agentforge-console
```

## Removing it

```powershell
aws s3 rm s3://hotelindoora-prod-releases --recursive --region ap-south-1 --profile agentforge-console
aws cloudformation delete-stack --stack-name hotelindoora-prod --region ap-south-1 --profile agentforge-console
```

The hotel's own data lives in its MongoDB cluster, not on these instances, so
deleting the stack never touches a booking.
