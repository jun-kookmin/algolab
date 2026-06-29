from enum import Enum

class GroupEnum(Enum):
    ADMINISTRATOR = 'Administrator'
    PROFESSOR = 'Professor'
    STUDENT = 'Student'

    def __str__(self):
        return '%s' % self.value


GROUP_ORDER = [GroupEnum.ADMINISTRATOR, GroupEnum.PROFESSOR, GroupEnum.STUDENT]
