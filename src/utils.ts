/** Utilities */

/**
 * Get Public IP
 */
export const getPublicIP = async () => {
  return await fetch("https://api.ipify.org")
    .then( response => response.text() )
    .then( ip => ip.trim() );
};
