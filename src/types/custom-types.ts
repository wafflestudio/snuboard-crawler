import { Department } from '../../server/src/department/department.entity';

export interface SiteData {
    department: Department;
    isPinned: boolean;
    isList: boolean;
    dateString: string;
    tag?: string;
    commonUrl?: string | null;
}

export interface CategoryTag {
    [key: string]: string;
}

export interface CrawlerInit {
    departmentName: string;
    departmentCode: string;
    departmentCollege: string;
    departmentLink?: string;
    baseUrl: string;
    excludedTags?: string[];
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
    tag?: string;
}

export interface ChemPageSummary {
    seqno: string;
    title: string;
    contents: string;
    wdate: string;
    file_path1: string;
    visit_cnt: string;
}
