Backbone.BindingView = Backbone.View.extend({

	errorClass: 'model-validation-error',
	invalidModels: [],

	//todo: similar guidance to overriding `initialize` as overriding `render`?
	initialize: function() {
		this.initializeBindings();
	},

	initializeBindings: function() {
		this.model.bind('change', this.modelChange, this);
		this.model.bind('error', this.modelValidationError, this);
	},

	prepareBindings: function() {
		var bindings = [];
		var events = {};

		_.each(_.keys(this.bindings), function(key) {
			//key format: 'selector' or 'attribute selector' or 'event attribute selector'
			var as = key.split(' ').reverse();
			var binding_selector = as[0];
			var binding_attribute = as.length > 1 ? as[1] : null;
			var binding_event = as.length > 2 ? as[2] : 'change';

			//value format: 'property' or ['property', 'formatter']
			if (_.isArray(this.bindings[key])) {
				var binding_property = this.bindings[key][0];
				var binding_formatter = this.bindings[key][1];
			} else {
				var binding_property = this.bindings[key];
				var binding_formatter = null;
			}

			if (binding_formatter && !this[binding_formatter])
				throw "Binding Formatter method '"+ binding_formatter +"' not found on view (did you implement it?)";

			var binding_value = binding_formatter ? this[binding_formatter].apply(this, [this.model.get(binding_property)]) : this.model.get(binding_property);

			bindings.push({property: binding_property,
									   formatter: binding_formatter,
									   value: binding_value,
									   selector: binding_selector,
									   attribute: binding_attribute});

			//set up DOM event listeners to be notified on change
			events[binding_event +' '+ binding_selector] = 'updateModel';
		}, this);

		this.delegateEvents(_.extend(events, this.events));

		return bindings;
	},

	renderBindings: function() {
		var t = this.getTemplate();

		this.preparedBindings = this.prepareBindings();

		//todo: set up model change event handler to refresh prepared binding value (via formatter) and re-render just that one
		//todo: option for one-way binding which won't set up event handlers or propagate change events (eg, if you're doing that yourself for some reason)
		_.each(this.preparedBindings, function(binding) {
			this.updateView(t, binding);
		}, this);

		//ignore the wrapper we added in getTemplate
		this.$el.html(t.contents());

		return this;
	},

	// when using binding view (via standard prototype inheritance)
	// you typically wouldn't override `render`, as the binding view
	// is taken care of for you. But if you want to do your own thing,
	// just be sure to call this.renderBindings();
	render: function() {
		return this.renderBindings();
	},

	modelChange: function() {
		var changedProps = _.keys(this.model.changed);
		var changedBindings = _.filter(this.preparedBindings, function(b){ return _.include(changedProps, b.property); });

		_.each(changedBindings, function(binding) {
			binding.value = binding.formatter ? this[binding.formatter].apply(this, [this.model.get(binding.property)]) : this.model.get(binding.property);
			this.updateView(this.$el, binding);
		}, this);
	},

	//if error is an object with a `property` key,
	//apply `errorClass` class to binding selector element
	modelValidationError: function(model, error) {
		if ((this.errorClass || '').length > 0) {
			var invalidBindings = _.filter(this.preparedBindings, function(b){ return _.include([error.property], b.property); });
			_.each(invalidBindings, function(binding) {			
				$(binding.selector).addClass(this.errorClass);
				this.invalidModels.push(model);
			}, this);
		}
	},

	updateView: function(el, binding) {
		var binding_el = el.find(binding.selector);

		if (binding.attribute === 'text' || (binding.attribute || '').length === 0) {
			// output is converted for html entities by default when no attr is specified in the binding
			binding_el.text(binding.value);
		} else if (binding.attribute === 'html') {
			// html entities not converted
			binding_el.html(binding.value);
		} else {
			// html entities not converted
			binding_el.attr(binding.attribute, binding.value);
		}

		//we need to set this so that if it changes,
		//we can identify the binding from the event handler
		binding_el.data('binding-definition', binding);

		//remove any prior validation errors upon a successful change
		if ((this.errorClass || '').length > 0) {
			binding_el.removeClass(this.errorClass);
		}
	},

	updateModel: function(e) {
		var view_el = $(e.currentTarget);
		var binding = view_el.data('binding-definition');

		if (binding) {
			//todo: right now, formatters are one-way. this kind of makes sense, but is also abnormal considering data is two-way
			//      perhaps instead of formatter, it should be Backbone.ModelBinder style converters?
			//      cf. https://github.com/theironcook/Backbone.ModelBinder#formatting-and-converting-values

			//remove `errorClass` and remove from `invalidModels`
			//if this update also fails validation, the class will be re-applied
			if (_.include(this.invalidModels, this.model)) {
				view_el.removeClass(this.errorClass);
				this.invalidModels = _.without(this.invalidModels, this.model);
			}

			if (binding.attribute === 'text' || (binding.attribute || '').length === 0) {
				this.model.set(binding.property, view_el.text());
			} else if (binding.attribute === 'html') {
				this.model.set(binding.property, view_el.html());
			} else {
				this.model.set(binding.property, view_el.attr(binding.attribute));
			}
		}
	},

	//override this method to provide your own html instead of using the `template` property
	//for example, a dynamically generated html snippet or using something like JST
	getTemplate: function() {
		//need one single element to apply initial binding selectors to
		//unwrapped before inserted into DOM
		return $('<'+ this.tagName +'>').append($(this.template).html());
	},
});
