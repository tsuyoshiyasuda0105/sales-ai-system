export type SecretEnvelope = {
  provider: "local_dev" | "aws_kms" | "gcp_kms";
  kmsKeyId?: string;
  encryptedDataKey?: Buffer;
  ciphertext: Buffer;
  algorithm: "AES-256-GCM";
};

export async function encryptSecret(plaintext: string): Promise<SecretEnvelope> {
  // Placeholder. Production implementation should use KMS envelope encryption.
  // local_dev exists only so MVP screens can be built before cloud setup.
  return {
    provider: "local_dev",
    ciphertext: Buffer.from(plaintext, "utf8"),
    algorithm: "AES-256-GCM"
  };
}

export async function decryptSecret(envelope: SecretEnvelope): Promise<string> {
  if (envelope.provider !== "local_dev") {
    throw new Error("KMS decrypt is not implemented yet");
  }

  return envelope.ciphertext.toString("utf8");
}
