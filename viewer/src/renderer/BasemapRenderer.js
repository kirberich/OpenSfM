/**
 * @format
 */

import {
  PlaneGeometry,
  Vector3,
  Mesh,
  TextureLoader,
  MeshBasicMaterial,
  Object3D,
  BufferGeometry,
  Float32BufferAttribute,
  Scene,
} from '../../node_modules/three/build/three.module.js';

import {
  geodeticToEnu,
  enuToGeodetic,
} from '../../../node_modules/mapillary-js/dist/mapillary.module.js';

function lng2tilex(lon, zoom) {
  return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
}
function lat2tiley(lat, zoom) {
  return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
}
function tilex2lng(x, z) {
  return (x / Math.pow(2, z) * 360 - 180);
}
function tiley2lat(y, z) {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
  return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
}

export class BasemapRenderer {
  constructor() {
    this._scene = new Scene();
    this._tiles = null;
  }

  get scene() {
    return this._scene;
  }

  onAdd(viewer, camera, reference) {
    this.onReference(reference);
  }

  onReference(reference) {
    this._clearTiles();
    this._tiles = this._createTiles(reference);
    this._scene.add(this._tiles);
  }

  onRemove() {
    this._clearTiles();
  }

  _clearTiles() {
    if (this._tiles) {
      this._scene.remove(this._tiles);
    }
  }

  _createTiles(reference) {
    const zoom = 19;

    // Find the tile nearest to 0,0,0 and pull that one and a the neighbors
    const lla = enuToGeodetic(
      0,
      0,
      0,
      reference.lng,
      reference.lat,
      reference.alt);

    const basemap = new Object3D();
    const x = lng2tilex(lla[0], zoom);
    const y = lat2tiley(lla[1], zoom);
    const n = 5
    for (var dx = -n; dx <= n; dx++) {
      for (var dy = -n; dy <= n; dy++) {
        basemap.add(this._createTile(x + dx, y + dy, zoom, reference));
      }
    }
    return basemap;
  }

  _makeTileGeometryFromCorners(point0, point1) {
    const diagonal = Math.sqrt(
      (point0[0] - point1[0]) ** 2 +
      (point0[1] - point1[1]) ** 2 +
      (point0[2] - point1[2]) ** 2
    )

    const side = diagonal / Math.sqrt(2)
    const width = side;
    const height = side;
    const geometry = new PlaneGeometry(width, height);

    const center = new Vector3(
      (point0[0] + point1[0]) / 2,
      (point0[1] + point1[1]) / 2,
      (point0[2] + point1[2]) / 2,
    );
    return { geometry, center };
  }

  _createTile(x, y, z, reference) {
    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`

    // Get corners of tile in geodetic coordinates
    const lng0 = tilex2lng(x, z);
    const lat0 = tiley2lat(y, z);
    const lng1 = tilex2lng(x + 1, z);
    const lat1 = tiley2lat(y + 1, z);

    // Get corners of tile in local (enu) reference frame
    const plane_altitude = -5; //reference.alt;
    const point0 = geodeticToEnu(
      lng0,
      lat0,
      plane_altitude,
      reference.lng,
      reference.lat,
      reference.alt,
    )
    const point1 = geodeticToEnu(
      lng1,
      lat1,
      plane_altitude,
      reference.lng,
      reference.lat,
      reference.alt,
    )

    const { geometry, center } = this._makeTileGeometryFromCorners(point0, point1);
    const texture = new TextureLoader().load(url);
    const material = new MeshBasicMaterial({ map: texture });
    const plane = new Mesh(geometry, material);

    plane.position.set(center.x, center.y, center.z);
    return plane;
  }
}