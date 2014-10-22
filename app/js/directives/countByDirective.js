'use strict';

/*
 * Copyright 2014 Next Century Corporation
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

angular.module("neonDemo.directives")
.directive('countBy', ['ConnectionService', function(connectionService) {
	return {
		templateUrl: 'partials/countby.html',
		restrict: 'E',
		scope: {
		},
		link: function($scope, el) {
			$scope.countField = "_id";
			$scope.fields = [];
			$scope.tableId = 'query-results-' + uuid();

			/**
			 * Initializes the name of the directive's scope variables
			 * and the Neon Messenger used to monitor data change events.
			 * @method initialize
			 */
			$scope.initialize = function() {
				var $tableDiv = $(el).find('.count-by-grid');
				$scope.createOptions([]);

				$tableDiv.attr("id", $scope.tableId);

				// Setup our messenger.
				$scope.messenger = new neon.eventing.Messenger();

				$scope.messenger.events({
					activeDatasetChanged: onDatasetChanged,
					filtersChanged: onFiltersChanged
				});

			};

			$scope.createOptions = function(data) {
				var options = {
					data: data.data,
					gridOptions: {
						forceFitColumns: true,
						enableColumnReorder: true,
						forceSyncScrolling: true
					}
				};

				return options;
			};

			/**
			 * Event handler for filter changed events issued over Neon's messaging channels.
			 * @method onFiltersChanged
			 * @private
			 */
			var onFiltersChanged = function() {
				$scope.queryForData();
			};

			/**
			 * Event handler for dataset changed events issued over Neon's messaging channels.
			 * @param {Object} message A Neon dataset changed message.
			 * @param {String} message.database The database that was selected.
			 * @param {String} message.table The table within the database that was selected.
			 * @method onDatasetChanged
			 * @private
			 */
			var onDatasetChanged = function(message) {
				XDATA.activityLogger.logSystemActivity('CountBy- received neon dataset changed event');
				$scope.databaseName = message.database;
				$scope.tableName = message.table;

				// if there is no active connection, try to make one.
				connectionService.connectToDataset(message.datastore, message.hostname, message.database, message.table);

				// Pull data.
				var connection = connectionService.getActiveConnection();
				if (connection) {
					connectionService.loadMetadata(function() {
						connection.getFieldNames($scope.tableName, function (results) {
							$scope.$apply(function() {
								$scope.fields = results;
								$scope.queryForData();
							});
						});
					});
				}
			};

			/**
			 * Triggers a Neon query that pull the a number of records that match the current Neon connection
			 * and filter set.  The query will be limited by the record number and sorted by the field
			 * selected in this directive's form.  This directive includes support for a show-data directive attribute
			 * that binds to a scope variable and controls table display.  If the bound variable evaulates to false,
			 * no data table is generated.  queryForData will not issue a query until the directive thinks it needs to
			 * poll for data and should show data.
			 * Resets internal "need to query" state to false.
			 * @method queryForData
			 */
			$scope.queryForData = function() {
				var connection = connectionService.getActiveConnection();
				if (connection) {
					var query = $scope.buildQuery();

					XDATA.activityLogger.logSystemActivity('CountBy - query for data');
					connection.executeQuery(query, function(queryResults) {
						XDATA.activityLogger.logSystemActivity('CountBy - received data');
						$scope.$apply(function(){
							$scope.updateData(queryResults);
							XDATA.activityLogger.logSystemActivity('CountBy - rendered data');
						});
					});
				}
			};

			$scope.stripIdField = function(dataObject) {
				var data = dataObject.data;

				var cleanData = [];
				for(var i = 0; i < data.length; i++) {
					var row = {};
					row[$scope.countField] = data[i][$scope.countField];
					row.count = data[i].count;

					//REMOVE THIS
					//row['_id'] = data[i]['_id'];

					cleanData.push(row);
				}
				dataObject.data = cleanData;
				return dataObject;
			};

			/**
			 * Updates the data bound to the table managed by this directive.  This will trigger a change in
			 * the chart's visualization.
			 * @param {Object} queryResults Results returned from a Neon query.
			 * @param {Array} queryResults.data The aggregate numbers for the heat chart cells.
			 * @method updateData
			 */
			$scope.updateData = function(queryResults) {
				var cleanData = $scope.stripIdField(queryResults);
				// Handle the new data.
				$scope.tableOptions = $scope.createOptions(cleanData);

				$scope.table = new tables.Table("#" + $scope.tableId, $scope.tableOptions).draw();
				$scope.table.refreshLayout();

			};

			/**
			 * Builds a query to pull a limited set of records that match any existing filter sets.
			 * @return neon.query.Query
			 * @method buildQuery
			 */
			$scope.buildQuery = function() {
				var query = new neon.query.Query().selectFrom($scope.databaseName, $scope.tableName)
				.groupBy($scope.countField);

				query.aggregate(neon.query.COUNT, '*', 'count');

				return query;
			};

			$scope.$watch('countField', function() {
				$scope.queryForData();
			});

			neon.ready(function () {
				$scope.initialize();
			});
		}
	};
}]);