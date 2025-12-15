import * as Location from 'expo-location';

export interface GeocodedAddress {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export interface GeocodingError {
  error: string;
  details?: unknown;
}

/**
 * Reverse geocode coordinates to get a readable address
 * Uses expo-location's built-in reverse geocoding
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<{ data: GeocodedAddress | null; error: GeocodingError | null }> {
  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (!addresses || addresses.length === 0) {
      return {
        data: null,
        error: { error: 'No address found for these coordinates' },
      };
    }

    const address = addresses[0];
    const formattedAddress = formatAddress(address);

    return {
      data: {
        name: formattedAddress,
        address: formattedAddress,
        latitude,
        longitude,
        formattedAddress,
      },
      error: null,
    };
  } catch (err) {
    console.error('Reverse geocoding error:', err);
    return {
      data: null,
      error: {
        error: 'Failed to reverse geocode address',
        details: err,
      },
    };
  }
}

/**
 * Forward geocode: search for addresses by query string
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */
export async function searchAddresses(
  query: string
): Promise<{ data: GeocodedAddress[] | null; error: GeocodingError | null }> {
  try {
    if (!query || query.trim().length < 2) {
      return { data: [], error: null };
    }

    // Use OpenStreetMap Nominatim API for address search
    const encodedQuery = encodeURIComponent(query.trim());
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=10&addressdetails=1&extratags=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HaloApp/1.0', // Required by Nominatim
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const results = await response.json();

    if (!Array.isArray(results) || results.length === 0) {
      return { data: [], error: null };
    }

    const addresses: GeocodedAddress[] = results.map((result: any) => {
      const address = result.address || {};
      const formattedAddress = formatNominatimAddress(result, address);

      return {
        name: result.display_name.split(',')[0] || formattedAddress,
        address: formattedAddress,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        formattedAddress: result.display_name || formattedAddress,
      };
    });

    return { data: addresses, error: null };
  } catch (err) {
    console.error('Address search error:', err);
    return {
      data: null,
      error: {
        error: 'Failed to search addresses',
        details: err,
      },
    };
  }
}

/**
 * Format address from expo-location reverse geocoding result
 */
function formatAddress(address: Location.LocationGeocodedAddress): string {
  const parts: string[] = [];

  if (address.street) parts.push(address.street);
  if (address.streetNumber) parts.push(address.streetNumber);
  if (address.city) parts.push(address.city);
  if (address.postalCode) parts.push(address.postalCode);
  if (address.country) parts.push(address.country);

  if (parts.length === 0) {
    // Fallback: use coordinates if no address parts available
    return `${address.latitude?.toFixed(6)}, ${address.longitude?.toFixed(6)}`;
  }

  return parts.join(', ');
}

/**
 * Format address from Nominatim API result
 */
function formatNominatimAddress(result: any, address: any): string {
  const parts: string[] = [];

  // Try to build a readable address from Nominatim address components
  if (address.road) {
    if (address.house_number) {
      parts.push(`${address.road} ${address.house_number}`);
    } else {
      parts.push(address.road);
    }
  } else if (address.pedestrian) {
    parts.push(address.pedestrian);
  }

  if (address.suburb || address.neighbourhood) {
    parts.push(address.suburb || address.neighbourhood);
  }

  if (address.city || address.town || address.village) {
    parts.push(address.city || address.town || address.village);
  }

  if (address.postcode) {
    parts.push(address.postcode);
  }

  if (address.country) {
    parts.push(address.country);
  }

  // Fallback to display_name if we couldn't build a good address
  if (parts.length === 0) {
    return result.display_name || `${result.lat}, ${result.lon}`;
  }

  return parts.join(', ');
}

