# deploy/aws — how hotelIndoora runs on AWS

Everything here is infrastructure as code, applied with the AWS CLI. Nothing in
this folder contains a value: the secret lives in AWS Secrets Manager, and the
parameter file holds ids, sizes and names only.

## What `ec2.yml` creates (one stack, `hotelindoora-prod`)

| Piece | What it is |
| --- | --- |
| One network | a VPC `10.0.0.0/16` this deployment owns, one public subnet `10.0.0.0/24` in one zone, its own internet gateway and route table. Nothing is shared with another project |
| Four EC2 instances | `gateway`, `auth`, `rooms` and `bookings`, each its own machine, all at the same size (`InstanceType`, `t4g.micro`), from the latest Amazon Linux 2023 arm64 image, at fixed private addresses `10.0.0.11` to `10.0.0.14` |
| One Elastic IP each | so the cluster's access list can name all four addresses, and the CloudFront origin never moves |
| nginx on each instance | listens on port 80 and proxies to the service bound on loopback |
| Security groups | the gateway takes port 80 only from CloudFront's origin-facing prefix list; each service takes port 80 only from the gateway's security group. Port 22 is never opened |
| IAM role | Systems Manager (administration with no open port), read on this application's release bucket, read on this application's secret, write on its own log groups. No access key, no wildcard resource |
| Release bucket | private, versioned, public access blocked, old releases expired |
| Four log groups | `/hotelindoora/prod/<service>`, 30-day retention, fed by the CloudWatch agent |
| Four alarms | a failed system status check asks EC2 to recover that instance |
| CloudFront distribution | the free HTTPS address; caching off, every method allowed, cookies and headers forwarded, HTTP redirected to HTTPS, `PriceClass_200` |
| No NAT gateway, no snapshots | the servers hold no data of their own — releases live in the versioned bucket and the hotel's data lives in its own cluster — so there is nothing on them to back up |

## The commands

```powershell
# create or update everything
aws cloudformation deploy --template-file deploy/aws/ec2.yml --stack-name hotelindoora-prod `
  --capabilities CAPABILITY_NAMED_IAM --parameter-overrides file://deploy/aws/params.json `
  --tags app=hotelindoora env=prod managed-by=agentforge `
  --no-fail-on-empty-changeset --region ap-south-1 --profile agentforge-console

# what it made
aws cloudformation describe-stacks --stack-name hotelindoora-prod --query "Stacks[0].Outputs" `
  --region ap-south-1 --profile agentforge-console
```

## Releasing and going back

`release.sh` runs **on an instance**, sent by Systems Manager, and is what a
release actually does:

```
release.sh <service> <s3-key> <secret-name> <region> <bucket> <port> [sha256]
```

It downloads the release from the bucket and — when the optional SHA-256 is given
— refuses it unless the bytes are the ones that were built; installs the
dependencies from the lockfile for Linux with `npm ci --omit=dev`; writes
`/etc/hotelindoora/env` from Secrets Manager at mode 600 with only the keys that
service needs (and, on `auth` alone, `/etc/hotelindoora/seed.env` for the
production seed); switches `current` to the new release, restarts the unit and
waits for the health route. If the health route does not answer it points
`current` back at the previous release, restarts, prints the unit's last lines and
exits non-zero. It keeps the last five releases.

`rollback.sh` does the same switch by hand when a release has to be taken back:

```powershell
aws ssm send-command --document-name AWS-RunShellScript --instance-ids <instance-id> `
  --parameters file://deploy/aws/rollback-params.json --region ap-south-1 --profile agentforge-console
```

## The first staff sign-in

The live site has no demo accounts. After the first release, the production seed
runs on the `auth` server with that server's own `seed.env`:

```bash
set -a; . /etc/hotelindoora/seed.env; set +a
cd /opt/hotelindoora/current && node scripts/seed-production.mjs
```

It writes the hotel's own details and room types idempotently, creates the first
staff account as an invitation with no password, and emails its own single-use
link. Running it again re-issues an expired invitation and changes nothing else.

## Removing it

```powershell
aws s3 rm s3://hotelindoora-prod-releases --recursive --region ap-south-1 --profile agentforge-console
aws cloudformation delete-stack --stack-name hotelindoora-prod --region ap-south-1 --profile agentforge-console
```

The hotel's own data lives in its MongoDB cluster, not on these instances, so
deleting the stack never touches a booking.
