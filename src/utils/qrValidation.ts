/** Keep this aligned with the payload written by QRCodeManager. */
export function matchesWakeUpCode(decodedValue: string, expectedSecret: string | null | undefined) {
  return typeof expectedSecret === 'string' && expectedSecret.length > 0 && decodedValue === expectedSecret;
}
