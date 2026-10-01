// GeoJSON stores [lng, lat]; the API speaks lat / lng. Convert only here.
export const toPoint = ({ lat, lng }) => ({ type: "Point", coordinates: [lng, lat] });

export const fromPoint = ({ coordinates: [lng, lat] }) => ({ lat, lng });
