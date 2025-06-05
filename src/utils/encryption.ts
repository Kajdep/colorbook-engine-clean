/// <reference types="vite/client" />

export function xorEncrypt(data: string, secret: string): string {
  let output = '';
  for (let i = 0; i < data.length; i++) {
    output += String.fromCharCode(data.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
  }
  return btoa(output);
}

export function xorDecrypt(encrypted: string, secret: string): string {
  const decoded = atob(encrypted);
  let output = '';
  for (let i = 0; i < decoded.length; i++) {
    output += String.fromCharCode(decoded.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
  }
  return output;
}

