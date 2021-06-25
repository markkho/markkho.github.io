var GridGameVisualizer = function () {
    //router
    this.MatchesRouter = Backbone.Router.extend({
	    routes: {
	        "trial/:match": "match",
	        "trial/:match/:round" : "match",
	        "trial/:match/:round/:turn" : "match"
	    }
	});

	// Instantiate the router
	this.router = new this.MatchesRouter();
	this.router.on('route:match', 
		$.proxy(function (match_num, round, turn) {
		    // load initial state
		    round = isNaN(round) || _.isUndefined(round)  || _.isNull(round) ? 1 : parseInt(round);
		    turn = isNaN(turn) || _.isUndefined(turn)  || _.isNull(turn) ? 0 : parseInt(turn);
		    console.log('new route: ' + [match_num, round, turn])

		    $('#current_match').text(match_num);
		    $('#current_round').text(round);

		    $('#trials-next').off('click');
			$('#trials-prev').off('click');
			$('#round-next').off('click');
			$('#round-prev').off('click');

		    //set up round and trial links
		    var match_template = _.template("<span> <a href='#trial/<%= match_num %>/<%= round %>'><%= round %></a>&nbsp;</span>"); //for populating
		    $('#round-list').html('');
		    _.each(this.matches[match_num], function (turns, round) {
		    	$('#round-list').append(match_template({match_num : match_num, round : round}));
		    }, this);

		    var trial_template = _.template("<span> <a href='#trial/<%= match_num %>/<%= round %>/<%= turn %>'><%= turn %></a>&nbsp;</span>");
		    $('#turn-list').html('');
		    _.each(this.matches[match_num][round], function (trial) {
		    	$('#turn-list').append(trial_template({match_num : match_num, round : round, turn : trial.Turn}));
		    }, this);

		    //load player info
		    var agent1_data = _.findWhere(this.main, {t_id : this.match_players[match_num][0]});
		    agent1_data.color = "<span style='color:orange'>Orange</span>"
		    var agent2_data = _.findWhere(this.main, {t_id : this.match_players[match_num][1]});
		    agent2_data.color = "<span style='color:blue'>Blue</span>"
			var playerinfo_template = _.template($('#playerinfo-template').html())
			$('#player1').html(playerinfo_template(agent1_data));
			$('#player2').html(playerinfo_template(agent2_data));

			//prepare animation and trial changes
		    var max_turn = parseInt(_.max(this.matches[match_num][round], function (m) {return parseInt(m['Turn'])})['Turn']);

		    if (turn <= max_turn) {
		    	$('#current_trial').text(turn);
			    var trial_to_show = _.findWhere(this.trials, {Match : match_num, Round : String(round), Turn : String(turn)});
			    var state = {
					agent1 : {name : 'agent1', 
							  location : [parseInt(trial_to_show['agent1_x']),parseInt(trial_to_show['agent1_y'])], 
							  type : 'agent'},
					agent2 : {name : 'agent2',
					          location : [parseInt(trial_to_show['agent2_x']),parseInt(trial_to_show['agent2_y'])], 
					          type : 'agent'}
				}

				var actions = {
					agent1 : trial_to_show.agent1_action,
					agent2 : trial_to_show.agent2_action
				}
			    this.painter.drawState(state);

			    var nextState = this.mdp.getTransition(state, actions);
			    var route_page = 'trial/'+match_num+'/'+round+'/'+(turn+1);
			    
			    var nextTrial = (function (painter, state, actions, nextState, mdp, router, route_page) {
			    	return function () {
			    		$('#trials-next').off('click');
			    		$('#trials-prev').off('click');
			    		var animationTime = painter.drawTransition(state, actions, nextState, mdp);
		    			setTimeout(function () {
			    			router.navigate(route_page, {trigger : true});
			    		},animationTime);	
			    		
			    	}
			    })(this.painter, state, actions, nextState, this.mdp, this.router, route_page)
		    
		    	$('#trials-next').on('click', nextTrial);
			}
			else {
				$('#current_trial').text('end');
			}
		    
		    var prevTrial = (function (router, prev_page) {
		    	return function () {
		    		$('#trials-prev').off('click');
		    		$('#trials-next').off('click');
		    		router.navigate(prev_page, {trigger : true, replace : true});
		    	}
		    })(this.router, 'trial/'+match_num+'/'+round+'/'+(turn-1))
		    if (turn > 0) {
		    	$('#trials-prev').on('click', prevTrial)
		    }

		    //set up interround controls
		    var max_round = _.max(_.keys(this.matches[match_num]), function (n) {return parseInt(n)}) ;
		    if (round < max_round) {
		    	var route_page = 'trial/'+match_num+'/'+(round+1)+'/0';
		    	$('#round-next').on('click', (function (router, route_page) {
		    		return function () {
			    		$('#round-next').off('click');
						$('#round-prev').off('click');
			    		router.navigate(route_page, {trigger :true, replace :true});
		    		}
		    	})(this.router, route_page))
		    }
		    if (round > 1) {
		    	var route_page = 'trial/'+match_num+'/'+(round-1)+'/0';
		    	$('#round-prev').on('click', (function (router, route_page) {
		    		return function () {
			    		$('#round-next').off('click');
						$('#round-prev').off('click');
			    		router.navigate(route_page, {trigger :true, replace :true});
			    	}
			    })(this.router, route_page))
		    }
		}, this));

	// Start Backbone history a necessary step for bookmarkable URL's
	Backbone.history.start();
}

GridGameVisualizer.prototype.init = function (trials, main, container_id) {
	this.main = main;
	this.container_id = container_id;


	this.participants = _.map(main, function (row) {return row['t_id']});

	//only use trials with worker data from main table
	this.trials = _.filter(trials, function (row) {
		if (_.contains(this.participants, row['agent1']) && _.contains(this.participants, row['agent2'])) {
			return true
		}
		return false
	}, this)

	this.match_nums = _.uniq(_.map(this.trials, function (t) {return t['Match']}));
	this.match_players = {}

	this.matches = {};
	var match_template = _.template("<span> <a href='#trial/<%= match_num %>'><%= match_num %></a>&nbsp;</span>"); //for populating match links
	for (var m = 0; m < this.match_nums.length; m++) {
		var match_num = this.match_nums[m]
		var match_trials = _.filter(this.trials, function (trial) {
			if (trial.Match == match_num) {
				return true
			}
			return false
		})
		var round_nums = _.uniq(_.pluck(match_trials, 'Round'))
		var rounds = {};
		for (var r = 0; r < round_nums.length; r++) {
			var round_num = round_nums[r];
			var turns = _.filter(match_trials, function (trial) {
				if (trial.Round == round_num) {
					return true
				}
				return false
			})
			rounds[round_num] = turns
		}
		this.matches[match_num] = rounds
		$('#match-list').append(match_template({match_num : match_num}));

		this.match_players[match_num] = [match_trials[0]['agent1'], match_trials[0]['agent2']]
	}

	//populate match links
	


	//get pairs
	//gridworld stuff
	this.gridworld  = {
			height : 3,
			width : 5,
			walls : [],
			goals : [{agent:'agent1', location: [4,1]}, {agent:'agent2', location: [0,1]}],
			agents : [{name : 'agent1'}, {name : 'agent2'}]
		};
	this.mdp = new ClientMDP(this.gridworld);

	this.painter = new GridWorldPainter(this.gridworld);
	this.painter.init(document.getElementById(this.container_id));
}

GridGameVisualizer.prototype.showMatch = function (match_num) {

}

