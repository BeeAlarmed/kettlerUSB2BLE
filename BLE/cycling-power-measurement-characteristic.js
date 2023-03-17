
var Bleno = require('@abandonware/bleno');
var DEBUG = false;

// Spec
//https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.cycling_power_measurement.xml

class CyclingPowerMeasurementCharacteristic extends  Bleno.Characteristic {
 
  constructor() {
    super({
      uuid: '2A63',
      value: null,
      properties: ['notify'],
      descriptors: [
        new Bleno.Descriptor({
					uuid: '2901',
					value: 'Cycling Power Measurement'
				}),
      ]
    });
    this._updateValueCallback = null;  
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    if (DEBUG) console.log('[powerService] client subscribed to PM');
    this._updateValueCallback = updateValueCallback;
    return this.RESULT_SUCCESS;
  };

  onUnsubscribe() {
    if (DEBUG) console.log('[powerService] client unsubscribed from PM');
    this._updateValueCallback = null;
    return this.RESULT_UNLIKELY_ERROR;
  };

  notify(event) {
    if (!('power' in event) && !('rpm' in event)) {
      // ignore events with no power and no crank data
      return this.RESULT_SUCCESS;;
    }
  
    if (this._updateValueCallback) {
		if (DEBUG) console.log("[powerService] Notify");
		var buffer = new Buffer(14);
		// flags
		// 00000001 - 1   - 0x001 - Pedal Power Balance Present
		// 00000010 - 2   - 0x002 - Pedal Power Balance Reference
		// 00000100 - 4   - 0x004 - Accumulated Torque Present
		// 00001000 - 8   - 0x008 - Accumulated Torque Source
		// 00010000 - 16  - 0x010 - Wheel Revolution Data Present
		// 00100000 - 32  - 0x020 - Crank Revolution Data Present
		// 01000000 - 64  - 0x040 - Extreme Force Magnitudes Present
		// 10000000 - 128 - 0x080 - Extreme Torque Magnitudes Present
	   
		buffer.writeUInt16LE(0x0030, 0);
		if ('power' in event) {
		  var power = event.power;
		  if (DEBUG) console.log("[powerService] power: " + power);
		  buffer.writeInt16LE(power, 2);
		}

	    	if ('WHEELcnt' in event) {
		  if (DEBUG) console.log("[powerService] wheel: " + event.WHEELcnt);
		  if (DEBUG) console.log("[powerService] wheel: " + event.WHEELtime);

		  buffer.writeUInt32LE(event.WHEELcnt, 4);
		  buffer.writeUInt16LE(event.WHEELtime, 8);
		}
	  
		if ('rpm' in event) {
		  if (DEBUG) { 
			  console.log("[powerService] rpm: " + event.rpm);
			  console.log("[powerService] RPMtime: " + event.RPMtime);
			  console.log("[powerService] RPMcnt: " + event.RPMcnt);
		  }
		  buffer.writeUInt16LE(event.RPMcnt, 10);
		  buffer.writeUInt16LE(event.RPMtime, 12);
		}

	   
      	this._updateValueCallback(buffer);
    }
    return this.RESULT_SUCCESS;
  }
  
  
};

module.exports = CyclingPowerMeasurementCharacteristic;
