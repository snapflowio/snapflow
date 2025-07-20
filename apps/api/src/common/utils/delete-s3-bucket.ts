import {
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectVersionsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Deletes an S3 bucket and all of its contents, including all object versions
 * and delete markers. This function handles pagination for buckets with a large
 * number of objects.
 *
 * This is a destructive operation and cannot be undone.
 *
 * @param s3 - An initialized S3Client instance from `@aws-sdk/client-s3`.
 * @param bucket - The name of the S3 bucket to delete.
 */
export async function deleteS3Bucket(s3: S3Client, bucket: string): Promise<void> {
  // Use pagination markers for buckets with many objects/versions.
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;

  // The `ListObjectVersions` command retrieves all object versions and delete
  // markers, making it suitable for both versioned and non-versioned buckets.
  // A second loop with `ListObjectsV2` is not necessary.
  do {
    const listResponse = await s3.send(
      new ListObjectVersionsCommand({
        Bucket: bucket,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      })
    );

    // Collect all versions and delete markers from the current page.
    const versions =
      listResponse.Versions?.map((v) => ({ Key: v.Key, VersionId: v.VersionId })) || [];
    const deleteMarkers =
      listResponse.DeleteMarkers?.map((d) => ({ Key: d.Key, VersionId: d.VersionId })) || [];
    const itemsToDelete = [...versions, ...deleteMarkers];

    // If there are items on the page, batch-delete them.
    if (itemsToDelete.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: itemsToDelete, Quiet: true },
        })
      );
    }

    // Set markers for the next page if the results are truncated.
    keyMarker = listResponse.NextKeyMarker;
    versionIdMarker = listResponse.NextVersionIdMarker;
  } while (keyMarker || versionIdMarker); // Continue until all pages are processed.

  // Once the bucket is empty, it can be deleted.
  await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
}
