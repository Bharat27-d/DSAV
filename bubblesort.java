public class bubblesort {
    int arr[] = {5, 1, 4, 2, 8};
    int n = arr.length;

    void bubblesort(){
        for (int i = 0; i < n - 1; i++){
            for (int j = 0; j < n - 1 - i; j++){
                if (arr[j] > arr[j + 1]){
                    int temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                }
            }
        }
;
        System.out.println("Sorted array:");
        for (int num : arr){
            System.out.print(num + " ");
        }
        System.out.println();
    }
    
    public static void main(String[] args) {
        bubblesort bs = new bubblesort();
        System.out.print("Original array:\n ");
        for (int num : bs.arr) {
            System.out.print(num + " ");
        }
        System.out.println();
        bs.bubblesort();
    }
}
