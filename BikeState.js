
const EventEmitter = require('events');
var DEBUG = false;

var minGear = 1;
var maxGear = 10;
var gearRatio = [0.2, 0.25, 0.3, 0.35, 0.5, 1.0, 1.6, 2.2, 3.5, 5];
var useRealCalc = true;
var wattIncPerSec = 5;
var wattDecPerSec = 25;


class BikeState extends EventEmitter {

	constructor() {
		super();
		console.log(`[BikeState starting]`);

		// init
		this.data = null;
		this.external = null;
		this.mode = 'ERG'; // ERG ou SIM
		this.gear = 1;

		this.lastRPM_time = 0;
		this.lastRPM_cnt  = 0;
		this.RPM_time = 0;
		this.RPM_cnt  = 0;
		
		this.lastWHEEL_time = 0;
		this.lastWHEEL_cnt  = 0;
		this.WHEEL_time = 0;
		this.WHEEL_cnt  = 0;

		this.currentPower = 50;
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
		this.compute();
		return this.data;
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


	compute_crank_revs_for_CPM() {
		this.data.RPMcnt = 0;
		this.data.RPMtime = 0;

		// pas de data du velo : on ne peut rien faire
		if (this.data == null)
			return;

		//
		// Update crank revs for the cycle power measurement char
		//
		var rpm = this.data.rpm;	
		this.data.RPMcnt = this.RPM_cnt;
		this.data.RPMtime = this.RPM_time;

		if(rpm){
			if(this.lastRPM_time == 0) {
				this.lastRPM_time = Date.now();
			}

			// Get time difference
			var current_time = Date.now();
			var t_diff = current_time - this.lastRPM_time;

			// Calculate revs made in the meantime
			var rpm_speed = (rpm / 60);
			var rpm_add = t_diff / 1000 * rpm_speed;

			// Full wheel change reached?
			var full_change = Math.floor(this.lastRPM_cnt + rpm_add) - Math.floor(this.lastRPM_cnt);
			if (full_change >= 1){
				this.lastRPM_cnt += rpm_add;
				this.lastRPM_time = current_time;

				// We can only sent full revs, so calculate time for the partial revs
				// and subtract it
				var partial_rpm_revs = this.lastRPM_cnt - Math.floor(this.lastRPM_cnt);
				var partial_rpm_time = partial_rpm_revs * (1000/rpm_speed);

				// Calculate new rev-time
				var t = ((current_time - partial_rpm_time)) * 1.024;
				var et = t % 65536;

				// Assign accumulated crank revs
				this.RPM_cnt = Math.floor(this.lastRPM_cnt);
				this.RPM_time = et;
				this.data.RPMcnt = this.RPM_cnt;
				this.data.RPMtime = this.RPM_time;
			}
		}
	};
	
	compute_wheel_revs_for_CPM() {
		this.data.WHEELcnt = 0;
		this.data.WHEELtime = 0;

		// pas de data du velo : on ne peut rien faire
		if (this.data == null)
			return;

		var rpm = this.data.rpm;	
		this.data.WHEELcnt = this.WHEEL_cnt;
		this.data.WHEELtime = this.WHEEL_time;

		if (rpm){
			if(this.lastWHEEL_time == 0) {
				this.lastWHEEL_time = Date.now();
			}

			var ratio = gearRatio[this.gear - 1];

			// Get time difference
			var current_time = Date.now();
			var t_diff = current_time - this.lastWHEEL_time;

			// Calculate revs made in the meantime
			var wheel_speed = (rpm / 60) * ratio;
			var wheel_add = t_diff / 1000 * wheel_speed;

			// Full wheel change reached?
			var full_change = Math.floor(this.lastWHEEL_cnt + wheel_add) - Math.floor(this.lastWHEEL_cnt);
			if (full_change >= 1){
				this.lastWHEEL_cnt += wheel_add;
				this.lastWHEEL_time = current_time;

				// We can only sent full wheel-revs, so calculate time for the partial revs
				// and subtract it
				var partial_wheel_revs = this.lastWHEEL_cnt - Math.floor(this.lastWHEEL_cnt);
				var partial_wheel_time = partial_wheel_revs * (1000/wheel_speed);

				// Calculate new rev-time
				var t = ((current_time - partial_wheel_time)) * 2.048;
				var et = t % 65536;

				// Assign accumulated crank revs
				this.WHEEL_cnt = Math.floor(this.lastWHEEL_cnt);
				this.WHEEL_time = et;
				this.data.WHEELcnt = this.WHEEL_cnt;
				this.data.WHEELtime = this.WHEEL_time;
			}
		}
	};

	// Do the math
	compute() {

		this.compute_crank_revs_for_CPM();
		this.compute_wheel_revs_for_CPM();

		// pas de data du velo : on ne peut rien faire
		if (this.data == null)
			return;

		// rien si en mode ERG
		if (this.mode === 'ERG')
			return;

		// pas de data externe : on ne peut rien faire
		if (this.external == null)
			return;

		var simpower = 0;
		if (useRealCalc){

			var G = 9.81;
			var weight = 80.0; 	// bike + driver 
			var circum = 2.1	// Wire circumference
			var ratio = gearRatio[this.gear -1];
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
			
			simpower = P;
		}else{

			simpower = 170 * (1 + 1.15 * (this.data.rpm - 80.0) / 80.0) * (1.0 + 3 * this.external.grade / 100.0);
			simpower = Math.max(0.0, simpower * (1.0 + 0.1 * (this.gear - 5)));
			simpower = simpower.toFixed(1);
		}	

		this.emit('targetpower', simpower);

		// Set power changes slowly
		if (this.currentPower <= simpower) {
			this.currentPower += wattIncPerSec;
			simpower = Math.min(simpower, this.currentPower);
		}else{
			this.currentPower -= wattDecPerSec;
			simpower = Math.max(simpower, this.currentPower);
		}

		if (DEBUG) {
			console.log('[BikeState.js] - SIM rpm: ', this.data.rpm);
			console.log('[BikeState.js] - SIM pente: ', this.external.grade);
			console.log('[BikeState.js] - SIM gear : ', this.gear);
			console.log('[BikeState.js] - SIM current power: ', this.currentPower);
			console.log('[BikeState.js] - SIM calculated power: ', simpower);
		}

		this.currentPower = simpower;
		this.emit('simpower', simpower);
	};
};

module.exports = BikeState

