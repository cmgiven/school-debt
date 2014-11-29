/*jslint browser: true*/
/*jslint nomen: true*/
/*global $, _, d3*/

(function () {
    'use strict';

    var app,
        Controls,
        LineChart,
        Map,
        BarTreemap,

        DATA_PATH = 'data/data.json';

    $(function () {
        $.ajax({
            url: DATA_PATH,
            dataType: 'json',
            success: app.initialize
        });
    });

    app = {
        data: {},
        components: {
            controls: {},
            compare: {},
            bars: {}
        },
        globals: {
            available: { years: [], states: [] },
            selected: { year: null, state: null },
            view: null
        },

        initialize: function (data) {
            app.data = data;

            app.globals.available.years  = _.pluck(data.VALUES, 'YEAR');
            app.globals.available.states = _.pluck(data.STATES, 'STATE');
            app.globals.selected.year = _.last(app.globals.available.years);
            app.globals.selected.state = 'All States';
            app.globals.view = 'LineChart';

            app.components.controls = new Controls('#controls', app);
            app.components.compare  = new LineChart('#compare', app);
            app.components.bars     = new BarTreemap('#bars', app);
        },

        updateSelected: function (key, value) {
            app.globals.selected[key] = value;

            _.each(app.components, function (component) {
                component.update(key, value);
            });
        },

        toggleView: function (newView) {
            if (app.globals.view !== newView) {
                $('#compare').children().remove();
                switch (newView) {
                case 'LineChart':
                    app.components.compare = new LineChart('#compare', app);
                    break;
                case 'Map':
                    app.components.compare = new Map('#compare', app);
                    break;
                }

                app.globals.view = newView;
            }
        }
    };

    Controls = function (el, owner) {
        this.owner = owner;
        this.$el = $(el);

        this.populateMenus();

        function onClick(e) {
            e.preventDefault();

            if ($(e.target).parents('.dropdown').length === 0) {
                var selector = $(e.currentTarget),
                    view = selector.data('view');

                selector.siblings().removeClass('selected');
                selector.addClass('selected');

                owner.toggleView(view);
            }
        }

        this.$el.children().click(onClick);
    };

    Controls.prototype.update = function (key, value) {
        var dropdown = this.$el.find('#' + key + '-selector .dropdown'),
            list = dropdown.children('.dropdown-menu');

        list.find('a').removeClass('selected');
        list.find('a:contains(' + value + ')').addClass('selected');
        dropdown.find('button span.text').text(value);
    };

    Controls.prototype.populateMenus = function () {
        var owner = this.owner,
            available = owner.globals.available,
            years = _.clone(available.years).reverse(),
            states = available.states,
            latestYear = years[0],
            yearList = this.$el.find('#year-selector .dropdown-menu'),
            stateList = this.$el.find('#state-selector .dropdown-menu');

        function populateMenu($el, data) {
            _.each(data, function (item) {
                $el.append($('<li>').append($('<a>')
                    .attr({
                        'role': 'menuitem',
                        'href': '#'
                    })
                    .text(item)));
            });
        }

        function onClick(e) {
            var type = $(this).data('type'),
                value = $(e.target).text();

            e.preventDefault();

            owner.updateSelected(type, value);
        }

        yearList.children().remove();
        populateMenu(yearList, years);
        yearList.find('li:first-child a').addClass('selected');
        this.$el.find('#year-button span.text').text(latestYear);
        yearList.click(onClick);

        stateList.children().remove();
        populateMenu(stateList, states);
        stateList.prepend($('<li><a role="menuitem" href="#" class="selected">All States</a></li>'));
        this.$el.find('#state-button span.text').text('All States');
        stateList.click(onClick);
    };

    LineChart = function (el, owner) {
        this.owner = owner;
        this.$el = $(el);
        this.properties = {
            width: this.$el.width(),
            height: this.$el.height()
        };
        this.svg = d3.select(el).append('svg')
            .attr('width', this.properties.width)
            .attr('height', this.properties.height);
    };

    LineChart.prototype.update = function (key, value) {
        //
    };

    Map = function (el, owner) {
        this.owner = owner;
        this.$el = $(el);
        this.properties = {
            width: this.$el.width(),
            height: this.$el.height()
        };
        this.svg = d3.select(el).append('svg')
            .attr('width', this.properties.width)
            .attr('height', this.properties.height);
    };

    Map.prototype.update = function (key, value) {
        //
    };

    BarTreemap = function (el, owner) {
        this.owner = owner;
        this.$el = $(el);
        this.properties = {
            width: this.$el.width(),
            height: this.$el.height()
        };
        this.svg = d3.select(el).append('svg')
            .attr('width', this.properties.width)
            .attr('height', this.properties.height);
    };

    BarTreemap.prototype.update = function (key, value) {
        //
    };

}());