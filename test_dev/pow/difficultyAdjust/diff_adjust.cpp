#include <stdio.h>
#include <stdint.h>
#include <ctime>
#include <map>

#include "diff_adjust.h"


uint32_t CalculateNextWorkRequired(uint32_t difficult,
                                        uint32_t nActualTimespan,
                                        uint32_t nStandardTimespan,
                                        const char* sPowLimit)
{

	uint256 powLimit = uint256S(sPowLimit);
	arith_uint256 bnTot {difficult};
	int64_t MinActualTimespan = (nStandardTimespan * ( 100 - 16 )) / 100;
	int64_t MaxActualTimespan = (nStandardTimespan * ( 100 + 32 )) / 100;

    // 3/4 AveragingWindowTimespan + 1/4 nActualTimespan
    nActualTimespan = nStandardTimespan + (nActualTimespan - nStandardTimespan)/4;
    
    if (nActualTimespan < MinActualTimespan)	//	84% adjustment up
        nActualTimespan = MinActualTimespan;
    if (nActualTimespan > MaxActualTimespan)	// 	132% adjustment down
        nActualTimespan = MaxActualTimespan;

    // Retarget
    const arith_uint256 bnPowLimit = UintToArith256(powLimit);
    arith_uint256 bnNew {bnTot};
    bnNew /= nStandardTimespan;
    bnNew *= nActualTimespan;

    if (bnNew > bnPowLimit)
        bnNew = bnPowLimit;

    return bnNew.GetCompact();
}


