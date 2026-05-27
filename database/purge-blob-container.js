/**
 * Elimina todos los blobs del contenedor configurado (AZURE_CONTAINER_NAME).
 * Uso: node database/purge-blob-container.js
 */
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const { BlobServiceClient } = require('@azure/storage-blob');

async function main() {
  const account = process.env.AZURE_STORAGE_ACCOUNT;
  const key = process.env.AZURE_STORAGE_KEY;
  const containerName = process.env.AZURE_CONTAINER_NAME || 'gestion-archivos';
  if (!account || !key) {
    console.error('Faltan AZURE_STORAGE_ACCOUNT o AZURE_STORAGE_KEY');
    process.exit(1);
  }
  const connectionString = `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${key};EndpointSuffix=core.windows.net`;
  const service = BlobServiceClient.fromConnectionString(connectionString);
  const container = service.getContainerClient(containerName);
  const exists = await container.exists();
  if (!exists) {
    console.error(`El contenedor "${containerName}" no existe.`);
    process.exit(1);
  }
  let n = 0;
  for await (const blob of container.listBlobsFlat()) {
    await container.deleteBlob(blob.name);
    n++;
    if (n % 100 === 0) process.stdout.write(`Eliminados ${n}…\n`);
  }
  console.log(`Listo: ${n} blob(s) eliminados del contenedor "${containerName}".`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
