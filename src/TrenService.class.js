class TrenService {
    
    constructor(systems = [], stations = []){
        this.systems = systems;
        this.stations = stations;
        this.watchOptions = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge:0
    	};
    }
        
    checkIfAvailableOnDevice(){
        return ('geolocation' in navigator);
    }
    
    async getCurrentCoordinates(){
        if(this.checkIfAvailableOnDevice() == false) throw "Browser does not support Geolcation";
        return new Promise((resolve,reject)=>{
           navigator.geolocation.getCurrentPosition(resolve,reject,{
               enableHighAccuracy: true,
               timeout: 3000,
               maximumAge:0
    		}); 
        });
    }
    
    async getNearest(){
        return new Promise((resolve,reject)=>{
           this.getCurrentCoordinates().then(res=>{
           	 resolve(this.nearestOne(res.coords.latitude,res.coords.longitude));
           }).catch(e=>{reject(e);}); 
        });
    }
    
    async getNearby(){
        return new Promise((resolve,reject)=>{
           this.getCurrentCoordinates().then(res=>{
           	 resolve(this.nearbyStations(res.coords.latitude,res.coords.longitude));
           }).catch(e=>{reject(e);}); 
        }); 
    }
    
    async startWatcher(){
		var wid = navigator.geolocation.watchPosition(res=>{
        	var ev = new CustomEvent('train-position',{detail:{ data:res }});
			dispatchEvent(ev);
            sessionStorage.setItem('train-watcher-id',wid);
    	});
    }
    
    async stopWatcher(){
        return new Promise((resolve,reject)=>{
           navigator.geolocation.clearWatch(sessionStorage.getItem('train-watcher-id'));
           resolve(true);
        });
    }
    
    getStationById(id = null){
        return (this.stations).find(obj=>{if(obj.id == id) return obj});
    }
    
    findStation(k,v){
        return (this.stations).find(obj=>{if(obj[k] == v) return obj});
    }
    
    filterStation(k,v){
        return (this.stations).filter(obj=>{if(obj[k] == v) return obj});
    }
    
    getSystemById(id = null){
        return (this.systems).find(obj=>{if(obj.id == id) return obj});
    }
    
    findSystem(k,v){
        return (this.systems).find(obj=>{if(obj[k] == v) return obj});
    }
    
    filterSystem(k,v){
        return (this.systems).find(obj=>{if(obj[k] == v) return obj});
    }
    
    mapSystem(array){
        var ar = [];
        array.forEach(obj=>{
            obj.station = this.getSystemById(obj.system_id);
            ar.push(obj);
        });        
        return ar;
    }
    
    pythagorasEquirectangular(lat1,lon1,lat2,lon2){
        function degToRad(i){
            return +i * Math.PI / 180;
        }
        
        lat1 = degToRad(lat1);
        lat2 = degToRad(lat2);
        lon1 = degToRad(lon1);
        lon2 = degToRad(lon2);
        var R = 6371; // Earth's radius in km
        var x = (lon2 - lon1) * Math.cos((lat1 + lat2) / 2);
        var y = (lat2 - lat1);
        var d = Math.sqrt(x * x + y * y) * R;
        return d;
    }
    
    distance(lat1,lon1,lat2,lon2){
        return this.pythagorasEquirectangular(lat1,lon1,lat2,lon2);
    }
    
    getDistances(lat,lon){
        var list = [];
        this.stations.forEach(obj=>{
            obj.distance = this.pythagorasEquirectangular(lat,lon,obj.latitude,obj.longitude);
            list.push(obj);
        });
        return list;
    }
    
    nearestOne(lat,lon){
        var dist = this.getDistances(lat,lon);
        return dist.find(obj=>{
            if(obj.distance < 0.20) return obj;
        });
    }
        
	nearbyStations(lat,lon){
     	var dist = this.getDistances(lat,lon);
        dist = dist.filter(obj=>{
            if(obj.distance < 1) return obj;
        });
        return dist.sort((a,b)=>{return b.distance - a.distance}).reverse();
    }
    
    getNextStations(id){
        var obj = this.getStationById(id);
        return {
            northbound: this.getStationById(obj.northbound_next),
            southbound: this.getStationById(obj.southbound_next)           
        };
    }
    
    getTransferStations(id){
        // get the station
        var obj = this.getStationById(id);
        // check if empty
        if(obj){
            try {
                var tmpObj = [];
                // loop to every transfer stations
                obj.transfer_stations.forEach(elem=>{
                    // push to array given station object
                   tmpObj.push(this.getStationById(elem)); 
                });
                return tmpObj;
            } catch(e){
              return [];  
            }
        } else {
            return [];
        }
    }
    
    appendBounds(system_id){
        return (this.filterStation("system_id",system_id)).map(obj=>{
           obj.northbound = this.getStationById(obj.northbound_next);
           obj.southbound = this.getStationById(obj.southbound_next);
           return obj;
        });
    }
    
    singleTransfer(from,from_trans,dest,dest_trans){
        // distance of from to same system transfer station
        var from_dist = this.distance(from.latitude,from.longitude,from_trans.latitude,from_trans.longitude);
        // distance of destination to transfer station
        var dest_dist = this.distance(dest.latitude,dest.longitude,dest_trans.latitude,dest_trans.longitude);
        // compute for walking distance (difference of 2 transfer stations)
        var walking_dist = this.distance(from_trans.latitude,from_trans.longitude,dest_trans.latitude,dest_trans.longitude);
        
        return {
            distance: +from_dist + +dest_dist,
            walking_distance: walking_dist,
            data: {
            	from_distance: from_dist,
                dest_distance: dest_dist
	        },
            route: [
                this.sameDestination(from,from_trans),
                this.sameDestination(dest,dest_trans)
            ]
        }
    }
    
    multipleTransfer(from,from_trans,dest,dest_trans, t1, t2){
        // from to from_dist
        var from_dist = this.distance(from.latitude,from.longitude,from_trans.latitude,from_trans.longitude);
        // dest to dest_trans
        var dest_dist = this.distance(dest.latitude,dest.longitude,dest_trans.latitude,dest_trans.longitude);
        // intermediate system distance
        var transfer_dist = this.distance(t1.latitude,t1.longitude,t2.latitude,t2.longitude);
        // compute for walk distance
        var walk_dist = 0;
        walk_dist = +walk_dist + +this.distance(from_trans.latitude,from_trans.longitude,t1.latitude,t1.longitude);
        walk_dist = +walk_dist + +this.distance(dest_trans.latitude,dest_trans.longitude,t2.latitude,t2.longitude);
        
        return {
            distance: +from_dist + +dest_dist + +transfer_dist,
            walking_distance: walk_dist,
            data: {
                from_distance: from_dist,
                dest_distance: dest_dist,
                transfer_distance: transfer_dist
            },
            route: [
                (this.sameDestination(from,from_trans)),
                (this.sameDestination(t1,t2)),
                (this.sameDestination(dest,dest_trans))
            ]
        }
    }
    
    sameDestination(from,dest){
        from.northbound = this.getStationById(from.northbound_next);
        from.southbound = this.getStationById(from.southboud_next);
        dest.northbound = this.getStationById(from.northbound_next);
        dest.southbound = this.getStationById(from.southbound_next);
        
        var list = this.stations;
        list = this.appendBounds(from.system_id);
          
        var is_nb = false;
        var is_sb = false;
          
        var route_north = [from];
        var route_south = [from];
          
        var nbc = list.length;
        var nbh = null;          
                    
        while(nbc !== 0){
			if(nbc == undefined) break;
            	if(is_nb == true) break; // check if reached station
          		if(nbh == null) nbh = from; // set pointer
              	
              	if(nbh.id == dest.id){
                  is_nb = true; break;
                } else {
                    nbh = nbh.northbound; if(nbh) route_north.push(nbh);
                }
              	 // set nbh
                nbc--; // lessen count to prevent infinte loop
       	}
          
        var sbc = list.length;
        var sbh = null;
          
        while(sbc !== 0){
            if(nbc == undefined) break;
            if(is_sb == true) break; // check if reached station
          	if(sbh == null) sbh = from; // set pointer
              	
            if(sbh.id == dest.id){
            	is_sb = true; break;
			} else {
            	sbh = sbh.southbound; if(sbh) route_south.push(sbh);
            }              	
            // set nbh
            sbc--; // lessen count to prevent infinte loop
        }
                
        var g;
        var r;
        if(is_nb == true){ g = "northbound"; r = route_north; }
        if(is_sb == true) { g = "southbound"; r = route_south; }
        
        return {
        	going: g,
            route: r,
            has_transfer: false,            
        }
          
    }
    
    route(from,dest){

	  if(from.system_id == dest.system_id){
          return this.sameDestination(from,dest);          
      } else {
          
          	// destination transfer station array
          	var dts = [];
          	var rc = [];
          	// get stations by destination system_id, filter transfer station
          	// loop to match connecting station
            (this.filterStation("system_id",dest.system_id)).filter(obj=>{
              if(obj.is_transfer_station == "true") return obj;
          	}).forEach(obj=>{
                var a = obj;
                var b = (this.getTransferStations(obj.id))[0];                
                dts.push({conn:b,dest:a});
            });
          
          	// loop to each transfer station 
          	dts.forEach(obj=>{
                if(obj.conn.system_id == from.system_id){
                    var res = this.singleTransfer(from,obj.conn,dest,obj.dest);
                    rc.push(res);
                } else {
                    (this.filterStation("system_id",obj.conn.system_id)).filter(obj=>{
                        if(obj.is_transfer_station == "true") return obj;
                    }).forEach(obj=>{
                        obj;
                    });
                }
            });
          
          
          // get the nearest transfer station of destination
          
          return {
              going:'multiple',
              route:null,
              has_transfer: true,
              route_choices: rc
          }
          
      }
        
    }
    
}
