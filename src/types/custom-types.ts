import { Department } from '../../server/src/department/department.entity';

export interface SiteData {
    department: Department;
    isPinned: boolean;
    isList: boolean;
    dateString: string;
    tag?: string;
}

export interface CategoryTag {
    [key: string]: string;
}

export interface CrawlerInit {
    departmentName: string;
    departmentCode: string;
    departmentCollege: string;
    baseUrl: string;
}

export interface CategoryCrawlerInit extends CrawlerInit {
    categoryTags: CategoryTag;
    excludedTag?: string;
}

export interface TitleAndTags {
    title: string;
    tags: string[];
}

export interface CrawlerOption {
    timeout?: number;
    startUrl?: string;
    isList?: boolean;
}
