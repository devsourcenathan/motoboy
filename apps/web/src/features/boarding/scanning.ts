/**
 * L'appareil sait-il lire un QR nativement ?
 *
 * Dans son propre fichier : le rafraîchissement rapide de Vite ne fonctionne que
 * sur des modules qui n'exportent que des composants, et mélanger une fonction
 * utilitaire au composant `Scanner` le désactivait pour tout le fichier.
 *
 * `BarcodeDetector` est natif sur Chrome Android — le terminal réel des agents —
 * et ne coûte rien au paquet. Là où il manque, la saisie manuelle prend le
 * relais : sur un quai, un QR froissé arrive, et un embarquement qui exige la
 * caméra bloque un passager qui a payé.
 */
export function scanningSupported(): boolean {
  return 'BarcodeDetector' in globalThis
}
