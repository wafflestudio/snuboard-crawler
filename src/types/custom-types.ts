import { Department, Tag } from '../../server/src/department/department.entity';

export interface SiteData {
    department: Department;
    isPinned: boolean;
    isList: boolean;
    dateString: string;
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
