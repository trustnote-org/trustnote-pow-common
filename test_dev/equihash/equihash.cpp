
#include "params.h"
#include "uint256.h"
#include "arith_uint256.h"
#include "blake2.h"
#include "equihash.h"

//Linkage with assembly
//EhPrepare takes in 136 bytes of input. The remaining 4 bytes of input is fed as nonce to EhSolver.
//EhPrepare saves the 136 bytes in context, and EhSolver can be called repeatedly with different nonce.
void EhPrepare(void *context, void *input);
int32_t EhSolver(void *context, uint32_t nonce);
extern char testinput[];

void ByteToHexStr(const uint8_t* source, char* dest, int sourceLen)
{
    short i;
    unsigned char highByte, lowByte;
 
    for (i = 0; i < sourceLen; i++)
    {
        highByte = source[i] >> 4;
        lowByte = source[i] & 0x0f ;

        if (highByte > 0x09)
                dest[i * 2] = highByte + 0x57;
        else
                dest[i * 2] = highByte | 0x30;
 
        if (lowByte > 0x09)
            dest[i * 2 + 1] = lowByte + 0x57;
        else
            dest[i * 2 + 1] = lowByte | 0x30;
    }
    return;
}


// 校验结果值hash是否符合难度要求
int checkProofOfWork(const char* sHash, int nBits, const char* sPowLimit)
{
	uint256 powLimit = uint256S(sPowLimit);
	uint256 hash = uint256S(sHash);

	bool fNegative;
    bool fOverflow;
    arith_uint256 bnTarget;

    bnTarget.SetCompact(nBits, &fNegative, &fOverflow);

	// Check range
    if (fNegative || bnTarget == 0 || fOverflow || bnTarget > UintToArith256(powLimit)){
		printf("nBits below minimum work.\n");
		return -1;
	}

	// Check proof of work matches claimed amount
    if (UintToArith256(hash) > bnTarget){
		printf("hash doesn't match nBits.\n");
		return -1;
	}
	
	return 0;
}


int equihash(uint8_t* input, uint32_t nonce, int nBits, const char* powLimit, int inputlen){

	void *context_alloc, *context;
	int32_t numsolutions;
	uint8_t outctx[32];
	char hash[64];
	int err = -1;

	context_alloc = malloc(CONTEXT_SIZE+4096);
	context = (void*) (((long) context_alloc+4095) & -4096);

	if(inputlen != 140)
		goto OUT;

	EhPrepare(context, input);
	numsolutions = EhSolver(context, nonce);
	printf("numsolutions = %d\n", numsolutions);
	for(int i = 0; i < numsolutions; i++){
		blake2b((uint8_t*)outctx, (uint8_t*)context+i*1344, NULL, sizeof(outctx), 1344, 0);
		ByteToHexStr(outctx, hash, 32);
		if(!checkProofOfWork(hash, nBits, powLimit)){
			printf("target = %.*s\n\n", 64, hash);
			err = 0; break;
		}
	}

OUT:
	free(context_alloc);
	return err;
}

