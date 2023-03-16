
const EventEmitter = require('events');
var DEBUG = false;

var minGear = 1;
var maxGear = 10;
var gearRatio = [0.4, 0.6, 0.9, 1.3, 1.8, 2.4, 3.1, 3.9, 4.8, 5.8];

class BikeState extends EventEmitter {

	constructor() {
		super();
		console.log(`[BikeState starting]`);

		// init
		this.data = null;
		this.external = null;
		this.mode = 'ERG'; // ERG ou SIM
		this.gear = 1;
	};

	// Restart the trainer
	restart() {
		this.mode = 'ERG'; // ERG ou SIM
		this.emit('mode', this.mode);
		// update and compute
		this.data = null;
	};

	// Set the bike under the FTMS control
	setControl() {};

	// Current state
	setData(data) {
		this.data = data;
		// update
		this.compute();
	};

	setGear(gear) {
		this.gear = gear;
		this.emit('gear', this.gear);
	}

	// Gear Up
	GearUp() {
		this.gear++;
		if (this.gear > maxGear)
			this.gear = maxGear;
		this.emit('gear', this.gear);
	};

	// Gear Down
	GearDown() {
		this.gear--;
		if (this.gear < minGear)
			this.gear = minGear;
		this.emit('gear', this.gear);
	};

	/* Puissance a atteindre */
	setTargetPower(power) {
		this.mode = 'ERG'; // ERG
		this.emit('mode', this.mode);
		// update and compute
		if (this.data == null)
			return;
		this.data.power = power;
		this.emit('simpower', this.data.power);
	};

	/* Modifie la puissance target */
	addPower(increment) {
		if (this.data == null)
			return;
		this.data.power += increment;
		// update and compute
		this.emit('simpower', this.data.power);
	};

	/* Mode Simulation : les conditions externes a simuler */
	setExternalCondition(windspeed, grade, crr, cw) {
		this.mode = 'SIM'; // ERG ou SIM
		this.emit('mode', this.mode);
		this.external = {
			windspeed: windspeed,
			grade: grade,
			crr: crr,
			cw: cw
		};
		this.emit('windspeed', (windspeed * 3.6).toFixed(1));
		this.emit('grade', (grade).toFixed(1));
	};

	// Do the math
	compute() {
		// rien si en mode ERG
		if (this.mode === 'ERG')
			return;
		// pas de data du velo : on ne peut rien faire
		if (this.data == null)
			return;
		// pas de data externe : on ne peut rien faire
		if (this.external == null)
			return;

		var G = 9.81;
		var weight = 80.0; 	// bike + driver 
		var circum = 2.1	// Wire circumference
		//var ratio = 0.61 + (this.gear -1) * 0.335
		//var ratio = 0.40 + (this.gear -1) * 0.2
		var ratio = gearRatio[this.gear];
		var losses = 0.05;

		var speed = this.data.rpm * ratio * circum / 60.0 ;

		// FG = 9.81 * sin(atan(grad)) * weight 
		var FG = G * Math.sin(this.external.grade / 180.0 * Math.PI) * weight;

		// FR = 9.81 * cos(atan(grad)) * weight * CRR
		var FR = G * Math.cos(this.external.grade / 180.0 * Math.PI) * weight * this.external.crr;

		// FA = 0.5 * CW * 1,225 * speed
		var FA = 0.5 * this.external.cw * 1.225 * speed;

		var P = (FG + FR + FA) * speed / ( 1 - losses);
		P = Math.max(50.0, P);
		P = P.toFixed(1);
		
		var simpower = P;
		

		//var simpower = 170 * (1 + 1.15 * (this.data.rpm - 80.0) / 80.0) * (1.0 + 3 * this.external.grade / 100.0);
		// apply gear
		//simpower = Math.max(0.0, simpower * (1.0 + 0.1 * (this.gear - 5)));
		// store
		//simpower = simpower.toFixed(1);

		if (DEBUG) {
			console.log('[BikeState.js] - SIM rpm: ', this.data.rpm);
			console.log('[BikeState.js] - SIM pente: ', this.external.grade);
			console.log('[BikeState.js] - SIM gear : ', this.gear);
			console.log('[BikeState.js] - SIM calculated power: ', simpower);
		}

		this.emit('simpower', simpower);
	};
};

module.exports = BikeState

