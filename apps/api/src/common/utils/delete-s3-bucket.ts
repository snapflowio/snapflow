import {
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export async function deleteS3Bucket(s3: S3Client, bucket: string): Promise<void> {
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;
  do {
    const versions = await s3.send(
      new ListObjectVersionsCommand({
        Bucket: bucket,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      })
    );
    const items = [
      ...(versions.Versions || []).map((v) => ({ Key: v.Key, VersionId: v.VersionId })),
      ...(versions.DeleteMarkers || []).map((d) => ({ Key: d.Key, VersionId: d.VersionId })),
    ];
    if (items.length) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: items, Quiet: true },
        })
      );
    }
    keyMarker = versions.NextKeyMarker;
    versionIdMarker = versions.NextVersionIdMarker;
  } while (keyMarker || versionIdMarker);

  let continuationToken: string | undefined;
  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    );

    if (list.Contents?.length) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: list.Contents.map((o) => ({ Key: o.Key })),
            Quiet: true,
          },
        })
      );
    }

    continuationToken = list.NextContinuationToken;
  } while (continuationToken);

  await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
}
