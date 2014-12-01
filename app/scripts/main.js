/*jslint browser: true*/
/*jslint nomen: true*/
/*global $, _, d3*/

(function () {
    'use strict';

    var app,
        Controls,
        Exhibit,
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
            $('#loading').fadeOut();
            $('#main').fadeIn();

            app.data = data;

            app.globals.available.years  = _.pluck(data.VALUES, 'YEAR');
            app.globals.available.states = _.pluck(data.STATES, 'STATE');
            app.globals.selected.year = _.last(app.globals.available.years);
            app.globals.selected.state = 'All States';
            app.globals.view = 'LineChart';

            app.components.controls = new Controls('#controls', app);
            app.components.compare  = new LineChart('#compare', app);
            app.components.bars     = new BarTreemap('#bars', app);

            $(window).resize(function () {
                app.components.compare.draw();
                app.components.bars.draw();
            });
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

    Controls.prototype.update = function (key, value) {
        var dropdown = this.$el.find('#' + key + '-selector .dropdown'),
            list = dropdown.children('.dropdown-menu');

        list.find('a').removeClass('selected');
        list.find('a:contains(' + value + ')').addClass('selected');
        dropdown.find('button span.text').text(value);
    };

    Exhibit = function (el, owner) {
        this.owner = owner;
        this.$el = $(el);
        this.svg = d3.select(el).append('svg').classed(this.classed, true);
        this.$el.append(this.title);

        this.draw();
    };

    Exhibit.create = function (prototype) {
        var parent = this,
            object = function () {
                parent.apply(this, arguments);
            };

        object.prototype = _.create(parent.prototype, prototype);

        return object;
    };

    Exhibit.prototype = {
        classed: 'exhibit',
        title: $('<h2>Exhibit<h2>'),

        drawBackground: function () { return; },
        drawData: function () { return; },
        updateYear: function () { return; },
        updateState: function () { return; },

        updateTitle: function () {
            var selected = this.owner.globals.selected,
                year = selected.year,
                state = selected.state,
                str = state === 'All States' ? '' : state;

            this.title.children('span.replace.year').text(year);
            this.title.children('span.replace.state').text(str);
        },

        draw: function () {
            this.drawBackground();
            this.drawData();
            this.updateYear(true);
            this.updateState(true);
            this.updateTitle();
        },

        update: function (key) {
            switch (key) {
            case 'year':
                this.updateYear();
                break;
            case 'state':
                this.updateState();
                break;
            }

            this.updateTitle();
        }
    };

    LineChart = Exhibit.create({
        classed: 'line-chart',
        title: $('<h2><span class="replace state"></span> debt as a share of annual revenue<h2>'),

        drawBackground: function () {
            var x, y, xAxis, yAxis, canvas,
                owner = this.owner,
                globals = owner.globals,
                svg = this.svg,
                margin = {top: 22, right: 30, bottom: 76, left: 50},
                width = this.$el.width() - margin.left - margin.right,
                height = this.$el.height() - margin.top - margin.bottom;

            svg.attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom);

            svg.select('g.canvas').remove();
            canvas = svg.append('g')
                .classed('canvas', true)
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            x = d3.scale.ordinal()
                .rangeBands([0, width], 0, 0.5)
                .domain(globals.available.years);

            y = d3.scale.linear()
                .range([height, 0])
                .domain([0, 1]);

            this.x = x;
            this.y = y;

            function yearTicks(years) {
                var i,
                    interval = width > 400 ? 2 : 4,
                    offset = (years.length % interval) - 1,
                    arr = [];

                for (i = offset; i < years.length; i += interval) {
                    arr.push(years[i]);
                }

                return arr;
            }

            xAxis = d3.svg.axis()
                .scale(x)
                .orient('bottom')
                .tickValues(yearTicks(globals.available.years));

            yAxis = d3.svg.axis()
                .scale(y)
                .orient('left')
                .ticks(5)
                .tickFormat(d3.format('%'))
                .tickSize(-width, 0, 0);

            this.linePath = d3.svg.line()
                .x(function (d) { return x(d.YEAR) + (x.rangeBand() / 2); })
                .y(function (d) { return y(d.TOTALDEBT / d.TOTALREV); });

            canvas.append('g')
                .attr('class', 'x axis')
                .attr('transform', 'translate(0,' + height + ')')
                .call(xAxis);

            canvas.append('g')
                .attr('class', 'y axis')
                .call(yAxis);

            this.line = canvas.append("path")
                .attr("class", "line");

            canvas.selectAll('.year')
                .data(globals.available.years)
                .enter().append('rect')
                .attr('id', function (d) { return 'yearrect-' + d; })
                .attr('class', 'year')
                .attr('x', function (d) { return x(d); })
                .attr('width', x.rangeBand())
                .attr('y', 0)
                .attr('height', height)
                .on('click', function (d) {
                    owner.updateSelected('year', d);
                });

            this.point = canvas.append("circle")
                .attr("class", "point")
                .attr('r', '9px');

            this.label = canvas.append("text")
                .attr("class", "label")
                .attr("text-anchor", "middle")
                .attr("dy", "-1em");
        },

        drawData: function () {
            var line = this.line,
                linePath = this.linePath,
                owner = this.owner,
                state = owner.globals.selected.state,
                data = state === 'All States' ?
                        owner.data.VALUES :
                        _.find(owner.data.STATES, { 'STATE': state }).VALUES;

            line.datum(data)
                .transition()
                .attr("d", linePath);
        },

        drawLabel: function (transition) {
            var x = this.x, y = this.y,
                point = this.point,
                label = this.label,
                duration = transition ? 250 : 0,
                owner = this.owner,
                selected = owner.globals.selected,
                year = selected.year,
                state = selected.state,
                data = state === 'All States' ?
                        owner.data.VALUES :
                        _.find(owner.data.STATES, { 'STATE': state }).VALUES,
                yearData = _.find(data, { 'YEAR': year });

            point.datum(yearData)
                .transition()
                .duration(duration)
                .attr('cx', x(year) + (x.rangeBand() / 2))
                .attr('cy', function (d) { return y(d.TOTALDEBT / d.TOTALREV); });

            label.datum(yearData)
                .text(function (d) { return Math.round(d.TOTALDEBT / d.TOTALREV * 100) + '%'; })
                .transition()
                .duration(duration)
                .attr('x', x(year) + (x.rangeBand() / 2))
                .attr('y', function (d) { return y(d.TOTALDEBT / d.TOTALREV); });
        },

        updateYear: function () {
            var year = this.owner.globals.selected.year;

            this.svg.selectAll('.year').classed('selected', false);
            this.svg.select('#yearrect-' + year).classed('selected', true);

            this.drawLabel();
        },

        updateState: function (initialDraw) {
            if (!initialDraw) {
                this.drawData();
                this.drawLabel(true);
            }
        }
    });

    Map = Exhibit.create({
        classed: 'map',
        title: $('<h2>debt as a share of annual revenue, <span class="replace year"></span><h2>')
    });

    BarTreemap = Exhibit.create({
        classed: 'bar-treemap',
        title: $('<h2><span class="replace state"></span> revenue and debt totals, <span class="replace year"></span><h2>'),

        series: {
            "TOTALREV": "Annual Revenue",
            "TOTALDEBT": "Outstanding Debt"
        },

        drawBackground: function () {
            var x, y, xAxis, yAxis, canvas,
                svg = this.svg,
                series = this.series,
                margin = {top: 50, right: 30, bottom: 76, left: 30},
                width = this.$el.width() - margin.left - margin.right,
                height = this.$el.height() - margin.top - margin.bottom;

            this.margin = margin;
            this.width = width;
            this.height = height;

            svg.attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom);

            svg.select('g.canvas').remove();
            canvas = svg.append('g')
                .classed('canvas', true)
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            x = d3.scale.ordinal()
                .rangeBands([0, width], 0.5, 0.25)
                .domain(_.keys(series));

            y = d3.scale.linear()
                .range([height, 0]);

            this.x = x;
            this.y = y;

            xAxis = d3.svg.axis()
                .scale(x)
                .orient('bottom')
                .tickFormat(function (d) {
                    return series[d];
                });

            yAxis = d3.svg.axis()
                .scale(y)
                .orient('left')
                .ticks(1)
                .tickSize(-width, 0, 0);

            canvas.append('g')
                .attr('class', 'x axis')
                .attr('transform', 'translate(0,' + height + ')')
                .call(xAxis);

            canvas.append('g')
                .attr('class', 'y axis')
                .call(yAxis);

            this.canvas = canvas;
        },

        drawData: function (update) {
            var max,
                height = this.height,
                canvas = this.canvas,
                x = this.x,
                y = this.y,
                owner = this.owner,
                selected = owner.globals.selected,
                state = selected.state,
                year = selected.year,
                national = state === 'All States',
                newDepth = national ? 0 : 1,
                aggregate = national ?
                        owner.data :
                        _.find(owner.data.STATES, { 'STATE': state }),
                children = national ?
                        aggregate.STATES :
                        aggregate.LEAS;

            if (update !== 'year') {
                max = _.reduce(aggregate.VALUES, function (max, year) {
                    return Math.max(max, year.TOTALREV, year.TOTALDEBT);
                }, 0);

                y.domain([0, max]);

                this.data = _.map(this.series, function (value, key) {
                    var treemap = d3.layout.treemap()
                            .ratio(2)
                            .sticky(true),
                        clones = _.map(children, function (child) {
                            return _.clone(child);
                        });

                    return {
                        key: key,
                        label: value,
                        width: x.rangeBand(),
                        offsetLeft: x(key),
                        children: clones,
                        treemap: treemap,
                        updateYear: function (year) {
                            this.value = _.find(aggregate.VALUES, { 'YEAR': year })[key];
                            this.offsetTop = y(this.value);
                            this.height = height - this.offsetTop - 2;
                            this.treemap.size([this.width, this.height])
                                .value(function (c) {
                                    return _.find(c.VALUES, { 'YEAR': year })[key];
                                });
                            return this;
                        }
                    };
                });
            }

            if (update !== 'state') {
                var g = canvas.selectAll("g.series")
                        .data(this.data);

                g.enter().append("g")
                    .attr('class', function (d) { return 'series ' + d.key; });

                g.each(function (d) {
                    var node,
                        selection = d3.select(this);

                    d.updateYear(year);

                    selection.transition().attr("transform", function (d) {
                        return "translate(" + d.offsetLeft + "," + d.offsetTop + ")";
                    });

                    node = selection.selectAll('.node')
                        .data(d.treemap.nodes);

                    node.enter().append('rect')
                        .attr('class', function (c) {
                            return 'node' + (c.depth === newDepth ? ' parent' : '');
                        })
                        .attr('title', function (c) { return national ? c.STATE : c.LEA; });

                    node.exit().remove();

                    // node
                });

                g.selectAll('.node').transition()
                    .attr('x', function (c) { return c.x; })
                    .attr('y', function (c) { return c.y; })
                    .attr('width', function (c) { return c.dx; })
                    .attr('height', function (c) { return c.dy; });
                
            } else if (this.depth === newDepth) {
                //jumping between states, hide and show
            } else {
                //moving between levels, animate
            }

            this.depth = newDepth;
        },

        updateYear: function (initialDraw) {
            if (!initialDraw) {
                this.drawData('year');
            }
        },

        updateState: function (initialDraw) {
            if (!initialDraw) {
                this.drawData('state');
            }
        }
    });

}());