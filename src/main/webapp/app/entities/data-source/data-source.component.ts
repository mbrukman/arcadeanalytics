import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs/Rx';
import { JhiEventManager, JhiParseLinks, JhiPaginationUtil, JhiLanguageService, JhiAlertService } from 'ng-jhipster';

import { DataSource } from './data-source.model';
import { DataSourceService } from './data-source.service';
import { WidgetService } from '../widget/widget.service';
import { NotificationService, ITEMS_PER_PAGE, Principal, ResponseWrapper } from '../../shared';
import { PaginationConfiguration } from '../../blocks/config/uib-pagination.config';
import { HttpResponse, HttpErrorResponse } from '@angular/common/http';

@Component({
    selector: 'jhi-data-source',
    templateUrl: './data-source.component.html',
    styleUrls: ['./data-source.component.scss']
})
export class DataSourceComponent implements OnInit, OnDestroy {

    currentAccount: any;
    dataSources: DataSource[];
    error: any;
    success: any;
    eventSubscriber: Subscription;
    currentSearch: string;
    routeData: any;
    links: any;
    totalItems: any;
    queryCount: any;
    itemsPerPage: any;
    page: any;
    predicate: any;
    previousPage: any;
    reverse: any;

    constructor(
        private dataSourceService: DataSourceService,
        private widgetService: WidgetService,
        private notificationService: NotificationService,
        private parseLinks: JhiParseLinks,
        private jhiAlertService: JhiAlertService,
        private principal: Principal,
        private activatedRoute: ActivatedRoute,
        private router: Router,
        private eventManager: JhiEventManager,
        private paginationUtil: JhiPaginationUtil,
        private paginationConfig: PaginationConfiguration
    ) {
        this.itemsPerPage = ITEMS_PER_PAGE;
        this.routeData = this.activatedRoute.data.subscribe((data) => {
            this.page = data['pagingParams'].page;
            this.previousPage = data['pagingParams'].page;
            this.reverse = data['pagingParams'].ascending;
            this.predicate = data['pagingParams'].predicate;
        });
        this.currentSearch = activatedRoute.snapshot.params['search'] ? activatedRoute.snapshot.params['search'] : '';
    }

    loadAll() {
        if (this.currentSearch) {
            this.dataSourceService.search({
                page: this.page - 1,
                query: this.currentSearch,
                size: this.itemsPerPage,
                sort: this.sort()
            }).subscribe(
                (res: HttpResponse<DataSource[]>) => this.onSuccess(res.body, res.headers),
                (res: HttpErrorResponse) => this.onError(res.error)
            );
            return;
        }
        this.dataSourceService.query({
            page: this.page - 1,
            size: this.itemsPerPage,
            sort: this.sort()
        }).subscribe(
            (res: HttpResponse<DataSource[]>) => this.onSuccess(res.body, res.headers),
            (res: HttpErrorResponse) => this.onError(res.error)
        );
    }

    loadPage(event: any, forceLoading?: boolean) {

        // if loadPage(..) called from an event update the page value according to that event, otherwise use the last value
        if (event && event.page) {
            this.page = event.page;
        }
        if (forceLoading) {
            this.transition();
            this.previousPage = this.page;
        } else if (this.page !== this.previousPage) {
            this.transition();
            this.previousPage = this.page;
        }
    }

    transition() {
        this.router.navigate(['/data-source'], {
            queryParams: {
                page: this.page,
                size: this.itemsPerPage,
                search: this.currentSearch,
                sort: this.predicate + ',' + (this.reverse ? 'asc' : 'desc')
            }
        });
        this.loadAll();
    }

    clear() {
        this.page = 0;
        this.currentSearch = '';
        this.router.navigate(['/data-source', {
            page: this.page,
            sort: this.predicate + ',' + (this.reverse ? 'asc' : 'desc')
        }]);
        this.loadAll();
    }

    search(query) {
        if (!query) {
            return this.clear();
        }
        this.page = 0;
        this.currentSearch = query;
        this.router.navigate(['/data-source', {
            search: this.currentSearch,
            page: this.page,
            sort: this.predicate + ',' + (this.reverse ? 'asc' : 'desc')
        }]);
        this.loadAll();
    }

    ngOnInit() {
        this.loadAll();
        this.principal.identity().then((account) => {
            this.currentAccount = account;
        });
        this.registerChangeInDataSources();
    }

    ngOnDestroy() {
        this.eventManager.destroy(this.eventSubscriber);
    }

    trackId(index: number, item: DataSource) {
        return item.id;
    }
    registerChangeInDataSources() {
        this.eventSubscriber = this.eventManager.subscribe('dataSourceModification', (response) => this.loadAll());
    }

    sort() {
        const result = [this.predicate + ',' + (this.reverse ? 'asc' : 'desc')];
        if (this.predicate !== 'id') {
            result.push('id');
        }
        return result;
    }

    handleSearchOnKeydown(event) {
        if (event.keyCode === 13) {
            this.search(this.currentSearch);
        } else if (event.keyCode === 46 || event.keyCode === 8) {
            setTimeout(() => {
                if (this.currentSearch === '') {
                    this.clear();
                }
            }, 10);
        }
    }

    callDatasourceIndexing(datasourceId: string) {
        this.widgetService.callDatasourceIndexing(datasourceId).subscribe((res: Object) => {
            const message: string = 'Indexing started.';
            this.notificationService.push('success', 'Full Text Index', message);

            this.checkDatasourceIndexingStatus(parseInt(datasourceId, 10));
        }, (error: HttpErrorResponse) => {
            this.handleError(error.error);
        });
    }

    checkDatasourceIndexingStatus(datasourceId: number) {
        this.dataSourceService.find(datasourceId).subscribe((res: DataSource) => {
            const dataSource = res;
            for (let i = 0; i < this.dataSources.length; i++) {
                const currDatasource = this.dataSources[i];
                if (currDatasource['id'] = dataSource['id']) {
                    if (!currDatasource['indexing'] || currDatasource['indexing'].toString() !== 'INDEXED') {
                        this.dataSources[i] = dataSource;
                        break;
                    }
                }
            }
            if (!dataSource['indexing'] || dataSource['indexing'].toString() !== 'INDEXED') {
                // wait for a while and check again
                setTimeout(() => {
                    this.checkDatasourceIndexingStatus(datasourceId);
                }, 30 * 1000);
            } else {
                // check completed, notify the user about the new datasource indexing status
                const message: string = 'Datasource indexing completed.';
                this.notificationService.push('success', 'Full Text Index', message);
            }
        });
    }

    handleError(error: any) {
        let message: string = '';
        if (error['detail']) {
            message = error['detail'];
            message = message.substring(0, 300) + ' ...';
        } else if (error['_body']['detail']) {
            message = error['_body']['detail'];
            message = message.substring(0, 300) + ' ...';
        }
        this.notificationService.push('error', 'Query', message);
    }

    private onSuccess(data, headers) {
        this.links = this.parseLinks.parse(headers.get('link'));
        this.totalItems = headers.get('X-Total-Count');
        this.queryCount = this.totalItems;
        // this.page = pagingParams.page;
        this.dataSources = data;
    }
    private onError(error) {
        this.jhiAlertService.error(error.message, null, null);
    }
}
