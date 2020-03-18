/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/

import {ECPolygon} from '../line/poly';
import * as graphic from '../../util/graphic';
import {bind, extend} from 'zrender/src/core/util';
import DataDiffer from '../../data/DataDiffer';
import ChartView from '../../view/Chart';
import ThemeRiverSeriesModel from './ThemeRiverSeries';
import GlobalModel from '../../model/Global';
import ExtensionAPI from '../../ExtensionAPI';
import { RectLike } from 'zrender/src/core/BoundingRect';

type LayerSeries = ReturnType<ThemeRiverSeriesModel['getLayerSeries']>

class ThemeRiverView extends ChartView {

    static readonly type = 'themeRiver'
    readonly type = ThemeRiverView.type

    private _layersSeries: LayerSeries
    private _layers: graphic.Group[] = []

    render(seriesModel: ThemeRiverSeriesModel, ecModel: GlobalModel, api: ExtensionAPI) {
        var data = seriesModel.getData();
        var self = this;

        var group = this.group;

        var layersSeries = seriesModel.getLayerSeries();

        var layoutInfo = data.getLayout('layoutInfo');
        var rect = layoutInfo.rect;
        var boundaryGap = layoutInfo.boundaryGap;

        group.attr('position', [0, rect.y + boundaryGap[0]]);

        function keyGetter(item: LayerSeries[number]) {
            return item.name;
        }
        var dataDiffer = new DataDiffer(
            this._layersSeries || [], layersSeries,
            keyGetter, keyGetter
        );

        var newLayersGroups: graphic.Group[] = [];

        dataDiffer
            .add(bind(process, this, 'add'))
            .update(bind(process, this, 'update'))
            .remove(bind(process, this, 'remove'))
            .execute();

        function process(status: 'add' | 'update' | 'remove', idx: number, oldIdx?: number) {
            var oldLayersGroups = self._layers;
            if (status === 'remove') {
                group.remove(oldLayersGroups[idx]);
                return;
            }
            var points0 = [];
            var points1 = [];
            var color;
            var indices = layersSeries[idx].indices;
            for (var j = 0; j < indices.length; j++) {
                var layout = data.getItemLayout(indices[j]);
                var x = layout.x;
                var y0 = layout.y0;
                var y = layout.y;

                points0.push([x, y0]);
                points1.push([x, y0 + y]);

                color = data.getItemVisual(indices[j], 'color');
            }

            var polygon: ECPolygon;
            var text: graphic.Text;
            var textLayout = data.getItemLayout(indices[0]);
            var labelModel = seriesModel.getModel('label');
            var margin = labelModel.get('margin');
            if (status === 'add') {
                const layerGroup = newLayersGroups[idx] = new graphic.Group();
                polygon = new ECPolygon({
                    shape: {
                        points: points0,
                        stackedOnPoints: points1,
                        smooth: 0.4,
                        stackedOnSmooth: 0.4,
                        smoothConstraint: false
                    },
                    z2: 0
                });
                text = new graphic.Text({
                    style: {
                        x: textLayout.x - margin,
                        y: textLayout.y0 + textLayout.y / 2
                    }
                });
                layerGroup.add(polygon);
                layerGroup.add(text);
                group.add(layerGroup);

                polygon.setClipPath(createGridClipShape(polygon.getBoundingRect(), seriesModel, function () {
                    polygon.removeClipPath();
                }));
            }
            else {
                const layerGroup = oldLayersGroups[oldIdx];
                polygon = layerGroup.childAt(0) as ECPolygon;
                text = layerGroup.childAt(1) as graphic.Text;
                group.add(layerGroup);

                newLayersGroups[idx] = layerGroup;

                graphic.updateProps(polygon, {
                    shape: {
                        points: points0,
                        stackedOnPoints: points1
                    }
                }, seriesModel);

                graphic.updateProps(text, {
                    style: {
                        x: textLayout.x - margin,
                        y: textLayout.y0 + textLayout.y / 2
                    }
                }, seriesModel);
            }

            var hoverItemStyleModel = seriesModel.getModel(['emphasis', 'itemStyle']);
            var itemStyleModel = seriesModel.getModel('itemStyle');

            graphic.setTextStyle(text.style, labelModel, {
                text: labelModel.get('show')
                    ? seriesModel.getFormattedLabel(indices[j - 1], 'normal')
                        || data.getName(indices[j - 1])
                    : null,
                textVerticalAlign: 'middle'
            });

            polygon.setStyle(extend({
                fill: color
            }, itemStyleModel.getItemStyle(['color'])));

            graphic.setHoverStyle(polygon, hoverItemStyleModel.getItemStyle());
        }

        this._layersSeries = layersSeries;
        this._layers = newLayersGroups;
    }
};

// add animation to the view
function createGridClipShape(rect: RectLike, seriesModel: ThemeRiverSeriesModel, cb: () => void) {
    var rectEl = new graphic.Rect({
        shape: {
            x: rect.x - 10,
            y: rect.y - 10,
            width: 0,
            height: rect.height + 20
        }
    });
    graphic.initProps(rectEl, {
        shape: {
            width: rect.width + 20,
            height: rect.height + 20
        }
    }, seriesModel, cb);

    return rectEl;
}


ChartView.registerClass(ThemeRiverView);