import DatasetController from '../core/core.datasetController.js';
import {resolveObjectKey, valueOrDefault} from '../helpers/index.js';

function getFirstScaleId(chart, axis) {
  const scales = chart.scales;
  return Object.keys(scales).filter(key => scales[key].axis === axis).shift();
}

export default class PolarController extends DatasetController {
  static id = 'polar';

  /**
   * @type {any}
   */
  static defaults = {
    datasetElementType: 'line',
    dataElementType: 'point',
    indexAxis: 't',
    showLine: true,
    elements: {
      line: {
        fill: 'start'
      }
    },
  };

  /**
   * @type {any}
   */
  static overrides = {
    aspectRatio: 1,

    scales: {
      _index_: {
        type: 'category',
      },
      r: {
        type: 'polarLinear',
      }
    }
  };

  linkScales() {
    const chart = this.chart;
    const meta = this._cachedMeta;
    const dataset = this.getDataset();

    const chooseId = (axis, x, y, r, t) => axis === 'x' ? x : axis === 'r' ? r : axis === 't' ? t : y;

    const xid = meta.xAxisID = valueOrDefault(dataset.xAxisID, getFirstScaleId(chart, 'x'));
    const yid = meta.yAxisID = valueOrDefault(dataset.yAxisID, getFirstScaleId(chart, 'y'));
    const rid = meta.rAxisID = valueOrDefault(dataset.rAxisID, getFirstScaleId(chart, 'r'));
    const tid = meta.tAxisID = valueOrDefault(dataset.rAxisID, getFirstScaleId(chart, 't'));
    const indexAxis = meta.indexAxis;
    const iid = meta.iAxisID = chooseId(indexAxis, xid, yid, rid, tid);
    const vid = meta.vAxisID = chooseId(indexAxis, yid, xid, tid, rid);
    meta.xScale = this.getScaleForId(xid);
    meta.yScale = this.getScaleForId(yid);
    meta.rScale = this.getScaleForId(rid);
    meta.tScale = this.getScaleForId(tid);
    meta.iScale = this.getScaleForId(iid);
    meta.vScale = this.getScaleForId(vid);
  }

  /**
	 * @protected
	 */
  getLabelAndValue(index) {
    const vScale = this._cachedMeta.vScale;
    const parsed = this.getParsed(index);

    return {
      label: vScale.getLabels()[index],
      value: '' + vScale.getLabelForValue(parsed[vScale.axis])
    };
  }

  /**
   * Parse array of arrays
   * @param {object} meta - dataset meta
   * @param {array} data - data array. Example [[1,2],[3,4]]
   * @param {number} start - start index
   * @param {number} count - number of items to parse
   * @returns {object} parsed item - item containing index and a parsed value
   * for each scale id.
   * Example: {x: 0, y: 1}
   * @protected
   */
  parseArrayData(meta, data, start, count) {
    const {tScale, rScale} = meta;
    const parsed = new Array(count);
    let i, ilen, index, item;

    for (i = 0, ilen = count; i < ilen; ++i) {
      index = i + start;
      item = data[index];
      parsed[i] = {
        t: tScale.parse(item[0], index),
        r: rScale.parse(item[1], index)
      };
    }
    return parsed;
  }

  /**
   * Parse array of objects
   * @param {object} meta - dataset meta
   * @param {array} data - data array. Example [{x:1, y:5}, {x:2, y:10}]
   * @param {number} start - start index
   * @param {number} count - number of items to parse
   * @returns {object} parsed item - item containing index and a parsed value
   * for each scale id. _custom is optional
   * Example: {xScale0: 0, yScale0: 1, _custom: {r: 10, foo: 'bar'}}
   * @protected
   */
  parseObjectData(meta, data, start, count) {
    const {tScale, rScale} = meta;
    const {tAxisKey = 't', rAxisKey = 'r'} = this._parsing;
    const parsed = new Array(count);
    let i, ilen, index, item;

    for (i = 0, ilen = count; i < ilen; ++i) {
      index = i + start;
      item = data[index];
      parsed[i] = {
        t: tScale.parse(resolveObjectKey(item, tAxisKey), index),
        r: rScale.parse(resolveObjectKey(item, rAxisKey), index)
      };
    }
    return parsed;
  }

  update(mode) {
    const meta = this._cachedMeta;
    const line = meta.dataset;
    const points = meta.data || [];
    const labels = meta.iScale.getLabels();

    // Update Line
    line.points = points;
    // In resize mode only point locations change, so no need to set the points or options.
    if (mode !== 'resize') {
      const options = this.resolveDatasetElementOptions(mode);
      if (!this.options.showLine) {
        options.borderWidth = 0;
      }

      const properties = {
        _loop: true,
        _fullLoop: labels.length === points.length,
        options
      };

      this.updateElement(line, undefined, properties, mode);
    }

    // Update Points
    this.updateElements(points, 0, points.length, mode);
  }

  updateElements(points, start, count, mode) {
    const tScale = this._cachedMeta.tScale;
    const rScale = this._cachedMeta.rScale;
    const reset = mode === 'reset';

    for (let i = start; i < start + count; i++) {
      const point = points[i];
      const options = this.resolveDataElementOptions(i, point.active ? 'active' : mode);
      const parsed = this.getParsed(i);
      const t = tScale.getDecimalForPixel(tScale.getPixelForValue(parsed.t, i));
      const pointPosition = rScale.getPointPositionForValue(t, parsed.r);

      const x = reset ? rScale.xCenter : pointPosition.x;
      const y = reset ? rScale.yCenter : pointPosition.y;

      const properties = {
        x,
        y,
        angle: pointPosition.angle,
        skip: isNaN(x) || isNaN(y),
        options
      };

      this.updateElement(point, i, properties, mode);
    }
  }
}
