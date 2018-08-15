//compile with
//gcc -o quickbench quickbench.c equihash_avx2.o
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <time.h>

#include "equihash.h"

extern char testinput[];

int main(void)
{
	void *context_alloc, *context, *context_end;
	uint32_t *pu32;
	uint64_t *pu64, previous_rdtsc;
	uint8_t inputheader[140];	//140 byte header
	FILE *infile, *outfile;
	struct timespec time0, time1;
	long t0, t1;
	int32_t numsolutions, total_solutions;
	uint32_t nonce, delta_time, total_time;
	int i, j;

	context_alloc = malloc(CONTEXT_SIZE+4096);
	context = (void*) (((long) context_alloc+4095) & -4096);
	context_end = context + CONTEXT_SIZE;

	infile = 0;
	infile = fopen("input.bin", "rb");
	if (infile) {
		puts("Reading input.bin");
		fread(inputheader, 140, 1, infile);
		fclose(infile);
	} else {
		puts("input.bin not found, use sample data (beta1 testnet block 2)");
		memcpy(inputheader, testinput, 140);
	}
	
	int res = equihash(inputheader,
		85,
		1,
	 	"0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
		sizeof(inputheader));
	



	free(context_alloc);
	return 0;
}
