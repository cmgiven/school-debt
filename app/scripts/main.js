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

        DATA_PATH = 'data/data.json',
        MAP_PATH = 'data/us-states.json';

    function dollarsInMillions(amount) {
        var i,
            millions = Math.round(amount / 1000000),
            string = String(millions);

        for (i = string.length - 3; i > 0; i -= 3) {
            string = string.slice(0, i) + ',' + string.slice(i, string.length);
        }

        return '$' + string + ' million';
    }

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
            view: null,
            animating: false
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

            Map.getData();

            $(window).resize(function () {
                app.components.compare.draw();
                app.components.bars.draw();
            });

            $(document).keydown(function (e) {
                if (app.globals.view === 'LineChart') {
                    switch (e.which) {
                    case 37: // left
                        app.shiftYear(true);
                        break;

                    case 39: // right
                        app.shiftYear();
                        break;

                    default:
                        return;
                    }

                    e.preventDefault();
                }
            });
        },

        updateSelected: function (key, value, animation) {
            app.globals.selected[key] = value;
            if (!animation) { app.toggleAnimation(true); }

            _.each(app.components, function (component) {
                component.update(key, value);
            });
        },

        shiftYear: function (decrement, animation) {
            var available = app.globals.available.years,
                selected = app.globals.selected.year,
                index = _.findIndex(available, function (year) {
                    return year === selected;
                }),
                newYear = decrement ?
                        available[index === 0 ? available.length - 1 : index - 1] :
                        available[index === available.length - 1 ? 0 : index + 1];

            app.updateSelected('year', newYear, animation);
        },

        highlight: function (el, key, value) {
            _.each(app.components, function (component) {
                if (component.highlight) { component.highlight(key, value); }
            });

            if (key === 'state') {
                app.displayTooltip(el, value);
            }
        },

        displayTooltip: function (el, value) {
            if (value && !app.globals.animating) {
                var tooltip, entity, parentEntity, values,
                    name, revenue, debt, offset, direction,
                    position = {}, size = { width: 320, height: 121 },
                    $el = $(el),
                    selected = app.globals.selected,
                    year = selected.year,
                    state = selected.state,
                    national = state === 'All States';

                if (national) {
                    entity = _.find(app.data.STATES, { 'STATE': value });
                    values = _.find(entity.VALUES, { 'YEAR': year });
                    name = value;
                } else {
                    parentEntity = _.find(app.data.STATES, { 'STATE': state });
                    entity = _.find(parentEntity.LEAS, { 'ID': value });
                    values = _.find(entity.VALUES, { 'YEAR': year });
                    name = entity.NAME;
                }

                revenue = values.TOTALREV;
                debt = values.TOTALDEBT;

                offset = $el.offset();

                direction = offset.left > $(window).width() / 2;

                position.left = direction ?
                        offset.left - size.width - 3 :
                        offset.left + parseInt($el.attr('width'), 10) + 3;

                position.top = offset.top - size.height - 4;

                tooltip = $('#tooltip');

                tooltip.css({
                    'left': position.left,
                    'top': position.top,
                    'width': size.width,
                    'height': size.height
                }).toggleClass('left-side', direction);

                tooltip.find('.name').text(name);
                tooltip.find('.revenue').text(dollarsInMillions(revenue));
                tooltip.find('.debt').text(dollarsInMillions(debt));

                tooltip.show();
            } else {
                $('#tooltip').hide();
            }
        },

        toggleAnimation: function (disable) {
            var startTime = null,
                toggle = $('#animate');

            function frame(time) {
                if (app.globals.animating) {
                    if (!startTime) {
                        app.shiftYear(false, true);
                        startTime = time;
                    }

                    var progress = time - startTime;

                    if (progress <= 500) {
                        window.requestAnimationFrame(frame);
                    } else {
                        startTime = null;
                        window.requestAnimationFrame(frame);
                    }
                }
            }

            if (app.globals.animating || disable) {
                app.globals.animating = false;

                toggle.removeClass('playing');
                toggle.addClass('paused');
                $('body').removeClass('animating');
            } else {
                app.globals.animating = true;
                window.requestAnimationFrame(frame);

                toggle.removeClass('paused');
                toggle.addClass('playing');
                $('body').addClass('animating');
            }
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

        function onSelectorClick(e) {
            e.preventDefault();

            if ($(e.target).parents('.dropdown').length === 0) {
                var selector = $(e.currentTarget),
                    view = selector.data('view');

                selector.siblings().removeClass('selected');
                selector.addClass('selected');

                owner.toggleView(view);
            }
        }

        function animationToggle(e) {
            if (!$(e.target).hasClass('disabled')) {
                owner.toggleAnimation();
            }
        }

        this.$el.children('.selector').click(onSelectorClick);
        this.$el.find('#animate').click(animationToggle);
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

        function onListClick(e) {
            var type = $(this).data('type'),
                value = $(e.target).text();

            e.preventDefault();

            owner.updateSelected(type, value);
        }

        yearList.children().remove();
        populateMenu(yearList, years);
        yearList.find('li:first-child a').addClass('selected');
        this.$el.find('#year-button span.text').text(latestYear);
        yearList.click(onListClick);

        stateList.children().remove();
        populateMenu(stateList, states);
        stateList.prepend($('<li><a role="menuitem" href="#" class="selected">All States</a></li>'));
        this.$el.find('#state-button span.text').text('All States');
        stateList.click(onListClick);
    };

    Controls.prototype.update = function (key, value) {
        var dropdown = this.$el.find('#' + key + '-selector .dropdown'),
            list = dropdown.children('.dropdown-menu');

        list.find('a').removeClass('selected');
        list.find('a:contains(' + value + ')').addClass('selected');
        dropdown.find('button span.text').text(value);

        if (key === 'state') {
            if (value === 'All States') {
                $('#animate').removeClass('disabled');
            } else {
                $('#animate').addClass('disabled');
            }
        }
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
        title: $('<h2>Exhibit</h2>'),

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
        title: $('<h2><span class="replace state"></span> debt as a share of annual revenue</h2>'),

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

            this.width = width;
            this.height = height;

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

            this.line = canvas.append('path')
                .attr('class', 'line');

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

            this.point = canvas.append('circle')
                .attr('class', 'point')
                .attr('r', '9px');

            this.label = canvas.append('text')
                .attr('class', 'label')
                .attr('text-anchor', 'middle')
                .attr('dy', '-1em');
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
                .attr('d', linePath);
        },

        drawLabel: function (transition) {
            var x = this.x, y = this.y,
                point = this.point,
                label = this.label,
                owner = this.owner,
                selected = owner.globals.selected,
                animating = owner.globals.animating,
                state = selected.state,
                year = selected.year,
                availableYears = owner.globals.available.years,
                yearIndex = _.findIndex(availableYears, function (test) {
                    return test === year;
                }),
                loopYear = yearIndex === 0,
                data = state === 'All States' ?
                        owner.data.VALUES :
                        _.find(owner.data.STATES, { 'STATE': state }).VALUES,
                yearData = _.find(data, { 'YEAR': year }),
                duration = animating ? 500 : transition ? 250 : 0;

            if (animating && loopYear) {
                point.datum(yearData)
                    .transition().duration(duration / 2)
                    .ease('cubic-in')
                    .attr('cx', this.width + 100)
                    .each('end', function () {
                        d3.select(this).attr('cx', -100)
                            .attr('cy', function (d) { return y(d.TOTALDEBT / d.TOTALREV); });
                    })
                    .transition().duration(duration / 2)
                    .ease('cubic-out')
                    .attr('cx', x(year) + (x.rangeBand() / 2));

                label.datum(yearData)
                    .transition().duration(duration / 2)
                    .ease('cubic-in')
                    .attr('x', this.width + 100)
                    .each('end', function () {
                        d3.select(this).attr('x', -100)
                            .attr('y', function (d) {
                                var posY = y(d.TOTALDEBT / d.TOTALREV);
                                posY = posY < 10 ? 10 : posY;
                                return posY;
                            })
                            .text(function (d) { return Math.round(d.TOTALDEBT / d.TOTALREV * 100) + '%'; });
                    })
                    .transition().duration(duration / 2)
                    .ease('cubic-out')
                    .attr('x', x(year) + (x.rangeBand() / 2));
            } else {
                point.datum(yearData)
                    .transition().duration(duration)
                    .ease(animating ? 'linear' : 'cubic-in-out')
                    .attr('cx', x(year) + (x.rangeBand() / 2))
                    .attr('cy', function (d) { return y(d.TOTALDEBT / d.TOTALREV); });

                label.datum(yearData)
                    .transition().duration(duration)
                    .ease(animating ? 'linear' : 'cubic-in-out')
                    .attr('x', x(year) + (x.rangeBand() / 2))
                    .attr('y', function (d) {
                        var posY = y(d.TOTALDEBT / d.TOTALREV);
                        posY = posY < 10 ? 10 : posY;
                        return posY;
                    })
                    .each('end', function () {
                        d3.select(this)
                            .text(function (d) { return Math.round(d.TOTALDEBT / d.TOTALREV * 100) + '%'; });
                    });
            }
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
        title: $('<h2>debt as a share of annual revenue, <span class="replace year"></span></h2>'),

        drawBackground: function () {
            console.log(this.$el.width());
            var svg = this.svg,
                margin = {top: 50, right: 30, bottom: 76, left: 30},
                width = this.$el.width() - margin.left - margin.right,
                height = this.$el.height() - margin.top - margin.bottom;

            svg.attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom);

            Map.getData(function (geojson) {
                var projection, path;

                projection = d3.geo.albersUsa()
                    .scale(600)
                    .translate([width / 2, height / 2]);

                path = d3.geo.path()
                    .projection(projection);

                svg.selectAll('path')
                    .data(geojson.features)
                    .enter().append("path")
                    .attr("d", path);
            });
        }
    });

    Map.getData = function (callback) {
        $.ajax({
            url: MAP_PATH,
            dataType: 'json',
            success: callback
        });
    };

    BarTreemap = Exhibit.create({
        classed: 'bar-treemap',
        title: $('<h2><span class="replace state"></span> revenue and debt totals, <span class="replace year"></span></h2>'),

        series: {
            'TOTALREV': 'Annual Revenue',
            'TOTALDEBT': 'Outstanding Debt'
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
            var g1, g2, max,
                height = this.height,
                canvas = this.canvas,
                x = this.x,
                y = this.y,
                owner = this.owner,
                selected = owner.globals.selected,
                state = selected.state,
                year = selected.year,
                national = state === 'All States',
                aggregate = national ?
                        owner.data :
                        _.find(owner.data.STATES, { 'STATE': state }),
                children = national ?
                        aggregate.STATES :
                        aggregate.LEAS,
                animating = app.globals.animating,
                tDuration = update && national ? animating ? 500 : 250 : 0;

            if (update !== 'year') {
                max = _.reduce(aggregate.VALUES, function (max, year) {
                    return Math.max(max, year.TOTALREV, year.TOTALDEBT);
                }, 0);

                y.domain([0, max]);

                this.data = _.map(this.series, function (value, key) {
                    var treemap = d3.layout.treemap()
                            .sticky(national)
                            .ratio(2),
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
                            this.height = height - this.offsetTop - 1;
                            this.treemap.size([this.width, this.height])
                                .value(function (c) {
                                    var m = _.find(c.VALUES, { 'YEAR': year }),
                                        v = m ? m[key] : 0;
                                    return v;
                                });
                            return this;
                        }
                    };
                });
            }

            function addBars(data) {
                var g = canvas.selectAll('g.series')
                    .data(data);

                g.enter().append('g')
                    .attr('class', function (d) { return 'series ' + d.key; });

                g.each(function (d) {
                    d3.select(this).append('text')
                        .datum(d)
                        .attr('class', 'label')
                        .attr('text-anchor', 'middle')
                        .attr('dy', '-.5em')
                        .attr('dx', d.width / 2);
                });

                return g;
            }

            g1 = addBars(this.data);

            function updateNodes(g) {
                g.each(function (d) {
                    var node,
                        selection = d3.select(this);

                    d.updateYear(year);

                    node = selection.selectAll('.node')
                        .data(d.treemap.nodes);

                    node.enter().append('rect')
                        .attr('class', function (c) {
                            return 'node'
                                + (c.depth === 0 ? ' parent' : '')
                                + (national ? ' state' : '');
                        })
                        .attr('title', function (c) { return national ? c.STATE : c.ID; });

                    if (national) {
                        node.on('click', function (d) {
                            owner.highlight('state', undefined);
                            owner.updateSelected('state', d.STATE);
                        });
                    }

                    node.on('mouseover', function (d) {
                        owner.highlight(this, 'state', national ? d.STATE : d.ID);
                    }).on('mouseout', function () {
                        owner.highlight(this, 'state', undefined);
                    });

                    node.exit().remove();
                });

                return g;
            }

            function resizeBars(g, zero) {
                g.attr('transform', function (d) {
                    if (zero) {
                        return 'translate(' + d.offsetLeft + ',' + height + ') scale(1 0)';
                    }

                    return 'translate(' + d.offsetLeft + ',' + d.offsetTop + ')';
                });
                return g;
            }

            function resizeNodes(g) {
                g.selectAll('.node')
                    .attr('x', function (c) { return c.x; })
                    .attr('y', function (c) { return c.y; })
                    .attr('width', function (c) { return c.dx; })
                    .attr('height', function (c) { return c.dy > 0 ? c.dy : 0; });
                return g;
            }

            function updateLabels(g) {
                if (g.tween) {
                    g.selectAll('.label')
                        .tween('text', function (d) {
                            var i = function (t) {
                                var amount;

                                if (t !== 1 && d.oldValue) {
                                    amount = d.oldValue + ((d.value - d.oldValue) * t);
                                } else {
                                    amount = d.value;
                                    d.oldValue = d.value;
                                }

                                return dollarsInMillions(amount);
                            };

                            return function (t) { this.textContent = i(t); };
                        });
                } else {
                    g.selectAll('.label')
                        .text(function (d) {
                            return dollarsInMillions(d.value);
                        });
                }
            }

            if (update !== 'state' || state === this.last.state) {
                g1.call(updateNodes)
                    .transition().duration(tDuration)
                    .ease(animating ? 'linear' : 'cubic-in-out')
                    .call(resizeBars)
                    .call(resizeNodes)
                    .call(updateLabels);

            } else {
                if (national) {
                    //zoom out from a state
                    g1.classed('series', false)
                        .transition().duration(500) //add state transform
                        .style('opacity', 0)
                        .remove();

                    g2 = addBars(this.data);

                    g2.call(updateNodes)
                        .call(resizeBars)
                        .call(resizeNodes)
                        .call(updateLabels)
                        .style('opacity', 0)
                        .transition().duration(500)
                        .style('opacity', 1);

                } else if (this.last.state === 'All States') {
                    //zoom in to a state
                    g1.classed('series', false)
                        .transition().duration(500)
                        .style('opacity', 0)
                        .remove();

                    g2 = addBars(this.data);

                    g2.call(updateNodes)
                        .call(resizeBars) //replace with state transform
                        .call(resizeNodes)
                        .call(updateLabels)
                        .style('opacity', 0)
                        .transition().duration(500)
                        .call(resizeBars)
                        .style('opacity', 1);

                } else {
                    //jumping between states, hide and show
                    g1.classed('series', false)
                        .transition().duration(500)
                        .call(resizeBars, true)
                        .style('opacity', 0)
                        .remove();

                    g2 = addBars(this.data);

                    g2.call(updateNodes)
                        .call(resizeBars, true)
                        .call(resizeNodes)
                        .call(updateLabels)
                        .transition().duration(500)
                        .call(resizeBars);
                }
            }

            this.last = {
                state: state,
                year: year
            };
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
        },

        highlight: function (key, value) {
            var nodes = this.canvas.selectAll('.node');
            if (key === 'state') {
                this.svg.classed('faded', value);
                nodes.classed('highlighted', false);
                if (value) {
                    nodes.each(function () {
                        if ($(this).attr('title') === value) {
                            d3.select(this).classed('highlighted', true);
                        }
                    });
                }
            }
        }
    });

}());