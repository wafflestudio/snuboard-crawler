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
    codeTags?: CategoryTag;
}

export interface TitleAndTags {
    title: string;
    tags: string[];
}

export interface ChemPageSummary {
    seqno: string;
    title: string;
    contents: string;
    wdate: string;
    file_path1: string;
    visit_cnt: string;
}
