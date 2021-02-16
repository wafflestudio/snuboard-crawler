import { Department } from '../../server/src/department/department.entity';

export interface SiteData {
    department: Department;
    isPinned: boolean;
}
