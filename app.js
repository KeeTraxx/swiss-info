var cantonsLayer = d3.select('#cantons');
var labelsLayer = d3.select('#labels');

var mover = false;
// nationalratdata

/*
 Run this code on https://www.parlament.ch/de/organe/nationalrat/mitglieder-nationalrat-a-z
 or https://www.parlament.ch/de/organe/staenderat/mitglieder-staenderat-a-z
 var data = [];
 jQuery('.p-list').each(function () {
 data.push( {
 img: jQuery('.image img', this).attr('src'),
 name: jQuery('.content h3', this).text().trim(),
 council: jQuery('.content h4.council', this).text().trim(),
 canton: jQuery('.content h4.canton', this).text().trim(),
 faction: jQuery('.fraktion span:first-child', this).text().trim(),
 factionAbbr: jQuery('.fraktion span:nth-child(2)', this).text().trim().replace(/[\(\)]/g, '')
 })
 });

 JSON.stringify(data);
 */

d3.json('ch.json', function (ch) {
    d3.json('council.json', function (council) {
        d3.csv('canton_data.csv', function (data) {
            data = data.map(function (d) {
                // convert to numbers
                Object.keys(d).forEach(function (prop) {
                    d[prop] = d[prop].match(/^[\d]+(\.[\d]+)?$/) ? parseFloat(d[prop]) : d[prop];
                });
                return d;
            });
            console.log(data);
            main(ch, council, data);
        });
    });
});

function negate(d) {
    return -d;
}

function main(ch, council, data) {

    var country = topojson.feature(ch, ch.objects.country);

    // convert geojson to topojson
    var cantons = topojson.feature(ch, ch.objects.cantons);

    // map council to topology
    // map data to topology
    var n = 0;
    cantons.features.forEach(function (canton) {
        canton.properties.coucillors = council.filter(function (councilor) {
            return councilor.canton == canton.properties.name;
        });

        canton.properties.data = data.find(function (data) {
            return data['Kantonsnummer'] == canton.properties.id;
        });

    });

    // fill metric checkbox
    d3.select('#metric')
        .on('change', redraw)
        .selectAll('option')
        .data(Object.keys(data[0]))
        .enter()
        .append('option')
        .text(String);


    var names = cantons.features.map(function (d) {
        return d.properties.name;
    });

    var projection = d3.geoAlbers()
        .rotate([0, 0])
        .center([7.4474, 46.9480])
        .scale(35000)
        .translate([480, 250])
        .fitExtent([[40, 40], [920, 460]], country.features[0])
        .precision(.1);

    var normalizer = d3.geoAlbers()
        .rotate([0, 0])
        .center([7.4474, 46.9480])
        .precision(.1);

    var path = d3.geoPath()
        .projection(projection);

    var features = cantons.features.filter(function (d) {
        return true;
    });

    var cantonsG = cantonsLayer.selectAll('g')
        .data(features, function (d) {
            return d.properties.id
        });

    cantonsG.enter()
        .append('g')
        .each(function (d) {
            d3.select(this)
                .append('path')
                .attr('d', path);

            var center = path.centroid(d);
        })
        .on('click', function (d) {
            mover = !mover;
            var html = Object.keys(d.properties.data).reduce(function(mem, k){
                mem += '<dt>'+k+'</dt>';
                mem += '<dd>'+d.properties.data[k]+'</dd>';
                return mem;
            }, '');

            console.log(d);

            html += '<dt>Nationalrat</dt>';
            html += '<dd>'+d.properties.coucillors.filter(function(d){return d.council=='Nationalrat'}).map(function(d){return d.name}).join(', ')+'</dd>';

            html += '<dt>St&auml;nderat</dt>';
            html += '<dd>'+d.properties.coucillors.filter(function(d){return d.council.indexOf('St') > -1}).map(function(d){return d.name}).join(', ')+'</dd>';

            d3.select('#data').html(html);
            redraw();
        });

    var colors = [
        ['#cfc', '#2f2'],
        ['#fcc', '#f22'],
        ['#ccf', '#22f']
    ];

    var colorInt = 0;

    function redraw() {
        var field = d3.select('#metric').property('value');
        features.sort(function (a, b) {
            return a.properties.data[field] - b.properties.data[field];
        });

        var colorizer;

        if (typeof features[0].properties.data[field] === 'string') {
            // string type coloring
            colorizer = d3.scaleOrdinal(d3.schemeCategory20);
        } else {
            // desc ordering if numbers
            features.reverse();

            colorizer = d3.scaleLinear()
                .domain(d3.extent(features, function (d) {
                    return d.properties.data[field];
                }))
                .range(colors[++colorInt % colors.length]);
        }

        cantonsLayer.selectAll('g').data(features, function (d) {
            return d.properties.id
        }).each(function (d, i) {
            var bounds = path.bounds(d);
            var size = [bounds[0][0] - bounds[1][0], bounds[0][1] - bounds[1][1]];
            var aspect = size[0] / size[1];
            if (aspect > 1) {
                normalizer.fitSize([100, 100 / aspect], d);
            } else {
                normalizer.fitSize([100 / aspect, 100], d);
            }

            var normalizerPath = d3.geoPath().projection(normalizer);
            //console.log('ah', d3.select(this).select('path'));
            d3.select(this).select('path')
                .transition()
                .duration(1200)
                .delay(i * 20)
                .attr('d', mover ? normalizerPath : path)
                .style('fill', function (d) {
                    return colorizer(d.properties.data[field])
                });

            var y = 20 + (~~(i / 7)) * 120;
            var x = 20 + (i % 7) * 120;

            d3.select(this)
                .transition()
                .duration(1200)
                .delay(i * 20)
                .attr('transform', mover ? 'translate(' + x + ',' + y + ')' : 'translate(0,0)');
        });
    }
}